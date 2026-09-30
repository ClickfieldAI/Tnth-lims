// Draft COA / Report service layer — authoritative server-side logic for
// Module 11. Mirrors lib/verification/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextReportCode } from "@/lib/ids";
import { findService } from "@/lib/enquiries/catalog";
import { DraftReportError, canDraftReport, type Actor } from "./access";
import { validateCreateDraftReport, type CreateDraftReportInput } from "./validation";
import type { TnthReportData, TnthReportSection } from "@/lib/tnth-report";

function assert(actor: Actor, cap: Parameters<typeof canDraftReport>[1]) {
  if (!canDraftReport(actor, cap)) throw new DraftReportError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadReport(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await prisma.draftReport.findUnique({
    where: { id },
    include: {
      sampleRegistration: { include: { trfSample: { include: { receipt: true } } } }, trf: true, customer: true, preparedBy: true, qaReview: { include: { reviewer: true } },
      items: { include: { testAllocation: { include: { trfTestRequest: true, result: { include: { analyst: true } } } } } },
    },
  }) as any;
  if (!r) throw new DraftReportError("NOT_FOUND", "Report not found.");
  return r;
}

// ---------------------------------------------------------------------------
// Verified results available to report on, per sample
// ---------------------------------------------------------------------------

export async function listVerifiedResultsForSample(actor: Actor, sampleRegistrationId: string) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = await prisma.sampleRegistration.findUnique({
    where: { id: sampleRegistrationId },
    include: { trfSample: { include: { tests: { include: { allocation: { include: { result: { include: { verification: true } } } } } } } } },
  }) as any;
  if (!reg) throw new DraftReportError("NOT_FOUND", "Registered sample not found.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (reg.trfSample.tests as any[])
    .filter((t) => t.allocation?.result?.verification?.status === "VERIFIED")
    .map((t) => ({ testAllocationId: t.allocation.id, testResultId: t.allocation.result.id, requestedParameter: t.requestedParameter, serviceId: t.serviceId, customRequest: t.customRequest, customServiceName: t.customServiceName }));
}

export interface ReportQueueParams { search?: string; status?: string; page?: number; pageSize?: number }

export async function listDraftReports(actor: Actor, params: ReportQueueParams) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.draftReport.findMany({ include: { sampleRegistration: true, trf: true, customer: true, items: true, qaReview: true } });

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.reportCode, r.sampleRegistration?.sampleCode, r.trf?.trfCode, r.customer?.name].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      draft: rows.filter((r) => r.status === "DRAFT").length,
      generated: rows.filter((r) => r.status === "GENERATED").length,
      sentForQa: rows.filter((r) => r.status === "SENT_FOR_QA").length,
    },
  };
}

export async function getDraftReport(actor: Actor, id: string) {
  assert(actor, "view");
  return loadReport(id);
}

// ---------------------------------------------------------------------------
// Create / generate / submit
// ---------------------------------------------------------------------------

export async function createDraftReport(actor: Actor, input: CreateDraftReportInput) {
  assert(actor, "create");
  const errors = validateCreateDraftReport(input);
  if (Object.keys(errors).length) throw new DraftReportError("VALIDATION", "Please fix the highlighted fields.", errors);

  const available = await listVerifiedResultsForSample(actor, input.sampleRegistrationId);
  const availableIds = new Set(available.map((a) => a.testResultId));
  for (const id of input.testResultIds) {
    if (!availableIds.has(id)) throw new DraftReportError("VALIDATION", "Only verified results for this sample can be included in the report.", { testResultIds: "Contains an unverified or unrelated result." });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = await prisma.sampleRegistration.findUnique({ where: { id: input.sampleRegistrationId } }) as any;
  const now = new Date();
  const count = await prisma.draftReport.count({});
  const code = nextReportCode(count + 1);
  const created = await prisma.draftReport.create({
    data: {
      reportCode: code, sampleRegistrationId: input.sampleRegistrationId, trfId: reg.trfId, customerId: reg.customerId,
      status: "DRAFT", preparedById: actor.id, revisionNumber: 1, previousVersionId: null,
      verifiedBy: "", authorisedSignatory: "", createdAt: now, updatedAt: now, generatedAt: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  for (const testAllocId of available.filter((a) => input.testResultIds.includes(a.testResultId)).map((a) => a.testAllocationId)) {
    await prisma.draftReportItem.create({ data: { draftReportId: created.id, testAllocationId: testAllocId, createdAt: now } });
  }
  await logAudit(actor.id, { action: "DRAFT_REPORT_CREATED", module: "reports", entityType: "draftReport", entityId: created.id, oldValue: null, newValue: { reportCode: code, sampleRegistrationId: input.sampleRegistrationId } });
  return { ok: true as const, id: created.id, reportCode: code };
}

export async function generateDraftReport(actor: Actor, id: string) {
  assert(actor, "edit");
  const r = await loadReport(id);
  if (r.status !== "DRAFT") throw new DraftReportError("CONFLICT", "Only a draft report can be generated.");
  if (!r.items.length) throw new DraftReportError("VALIDATION", "Add at least one verified result before generating this report.");

  const now = new Date();
  await prisma.draftReport.update({ where: { id }, data: { status: "GENERATED", generatedAt: now, updatedAt: now } });
  await logAudit(actor.id, { action: "DRAFT_REPORT_GENERATED", module: "reports", entityType: "draftReport", entityId: id, oldValue: { status: "DRAFT" }, newValue: { status: "GENERATED" } });
  return { ok: true as const };
}

export async function submitDraftReportForQa(actor: Actor, id: string) {
  assert(actor, "submitForQa");
  const r = await loadReport(id);
  if (r.status !== "GENERATED") throw new DraftReportError("CONFLICT", "Only a generated report can be sent for QA review.");

  await prisma.draftReport.update({ where: { id }, data: { status: "SENT_FOR_QA", updatedAt: new Date() } });
  await prisma.qaReview.create({ data: { draftReportId: id, status: "PENDING", reviewerId: null, reviewedAt: null, comments: "", returnReason: null, createdAt: new Date(), updatedAt: new Date() } });
  await logAudit(actor.id, { action: "DRAFT_REPORT_SENT_FOR_QA", module: "reports", entityType: "draftReport", entityId: id, oldValue: { status: "GENERATED" }, newValue: { status: "SENT_FOR_QA" } });
  return { ok: true as const };
}

/** Creates a new revision (used after a QA return, or any post-approval change) rather than mutating an issued report. */
export async function createReportRevision(actor: Actor, id: string, reason: string) {
  assert(actor, "edit");
  if (!reason.trim()) throw new DraftReportError("VALIDATION", "A reason is required to create a new revision.", { reason: "Required" });
  const r = await loadReport(id);

  const now = new Date();
  const created = await prisma.draftReport.create({
    data: {
      reportCode: r.reportCode, sampleRegistrationId: r.sampleRegistrationId, trfId: r.trfId, customerId: r.customerId,
      status: "DRAFT", preparedById: actor.id, revisionNumber: r.revisionNumber + 1, previousVersionId: r.id,
      verifiedBy: r.verifiedBy, authorisedSignatory: r.authorisedSignatory, createdAt: now, updatedAt: now, generatedAt: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of r.items as any[]) {
    await prisma.draftReportItem.create({ data: { draftReportId: created.id, testAllocationId: it.testAllocationId, createdAt: now } });
  }
  await logAudit(actor.id, { action: "DRAFT_REPORT_REVISION_CREATED", module: "reports", entityType: "draftReport", entityId: created.id, oldValue: { previousVersion: r.id }, newValue: { revisionNumber: created.revisionNumber, reason } });
  return { ok: true as const, id: created.id, reportCode: created.reportCode };
}

export async function getReportHistory(actor: Actor, draftReportId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "reports", entityId: draftReportId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}

// ---------------------------------------------------------------------------
// PDF data mapping — reuses the existing official TNTH template renderer
// (lib/tnth-pdf.ts's generateTnthReportPdf) unchanged; only the data source
// differs (verified results from this module's pipeline instead of the
// legacy sample/test model).
// ---------------------------------------------------------------------------

export async function getDraftReportPdfData(actor: Actor, id: string): Promise<TnthReportData> {
  assert(actor, "view");
  const r = await loadReport(id);
  const reg = r.sampleRegistration;

  const rows = (r.items as { testAllocation: { trfTestRequest: { requestedParameter: string; preferredMethod?: string; customRequest: boolean; customServiceName?: string; serviceId?: string }; result: { resultValue: string; unit?: string; referenceValue?: string } } }[])
    .map((it, i) => ({
      sNo: String(i + 1),
      parameter: it.testAllocation.trfTestRequest.customRequest ? (it.testAllocation.trfTestRequest.customServiceName ?? it.testAllocation.trfTestRequest.requestedParameter) : it.testAllocation.trfTestRequest.requestedParameter,
      method: it.testAllocation.trfTestRequest.preferredMethod || (findService(it.testAllocation.trfTestRequest.serviceId ?? "")?.division ?? "—"),
      unit: it.testAllocation.result.unit || "—",
      result: it.testAllocation.result.resultValue,
      limit: it.testAllocation.result.referenceValue || "—",
    }));

  const sections: TnthReportSection[] = [{ heading: "Test Results", rows }];

  return {
    reportNo: r.reportCode,
    date: new Date(r.generatedAt ?? r.createdAt).toLocaleDateString("en-GB"),
    customerName: r.customer?.name ?? "—",
    address: [r.customer?.billing?.city, r.customer?.billing?.country].filter(Boolean).join(", ") || "—",
    sampleDescription: `${reg?.sampleCode ?? "—"} — ${reg?.trfSample?.sampleName ?? ""}`.trim(),
    batchNo: reg?.trfSample?.batchNumber || "—",
    sampleQuantity: reg?.trfSample ? `${reg.trfSample.quantity} ${reg.trfSample.quantityUnit}` : "—",
    packingCondition: reg?.trfSample?.receipt?.containerCondition || "—",
    sampleReceivedOn: reg?.trfSample?.receipt ? new Date(reg.trfSample.receipt.receivedAt).toLocaleDateString("en-GB") : "—",
    analysisStartedOn: "—",
    analysisCompletedOn: r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("en-GB") : "—",
    sections,
    verifiedBy: r.verifiedBy || "Quality Assurance",
    authorisedSignatory: r.authorisedSignatory || "Laboratory Manager",
  };
}
