// Authorized Approval & Release service layer — authoritative server-side
// logic for Module 13. Mirrors lib/qa-review/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ReleaseError, canRelease, type Actor } from "./access";
import { validateReturnReason } from "./validation";
import { ensureRetentionRecord } from "@/lib/retention/service";

function assert(actor: Actor, cap: Parameters<typeof canRelease>[1]) {
  if (!canRelease(actor, cap)) throw new ReleaseError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadReport(draftReportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = await prisma.draftReport.findUnique({
    where: { id: draftReportId },
    include: {
      sampleRegistration: true, trf: true, customer: true, preparedBy: true,
      items: { include: { testAllocation: { include: { trfTestRequest: true, result: true } } } },
      qaReview: { include: { reviewer: true } }, release: { include: { releasedBy: true } },
    },
  }) as any;
  if (!report) throw new ReleaseError("NOT_FOUND", "Report not found.");
  return report;
}

async function ensureReleaseRow(draftReportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rel = await prisma.reportRelease.findFirst({ where: { draftReportId } }) as any;
  if (!rel) {
    const now = new Date();
    rel = await prisma.reportRelease.create({ data: { draftReportId, status: "PENDING", releasedAt: null, releasedById: null, returnReason: null, comments: "", createdAt: now, updatedAt: now } });
  }
  return rel;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface ReleaseQueueParams { search?: string; status?: string; page?: number; pageSize?: number }

export async function listReleaseQueue(actor: Actor, params: ReleaseQueueParams) {
  assert(actor, "view");
  // Only QA-approved reports are eligible — never merely-generated or draft reports.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.draftReport.findMany({
    where: { status: "SENT_FOR_QA" },
    include: { sampleRegistration: true, trf: true, customer: true, items: true, qaReview: true, release: { include: { releasedBy: true } } },
  });
  rows = rows.filter((r) => r.qaReview?.status === "APPROVED");

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.reportCode, r.sampleRegistration?.sampleCode, r.trf?.trfCode, r.customer?.name].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => (r.release?.status ?? "PENDING") === params.status);
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => (r.release?.status ?? "PENDING") === "PENDING").length,
      released: rows.filter((r) => r.release?.status === "RELEASED").length,
      returned: rows.filter((r) => r.release?.status === "RETURNED").length,
    },
  };
}

export async function getReportForRelease(actor: Actor, draftReportId: string) {
  assert(actor, "view");
  return loadReport(draftReportId);
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export async function releaseReport(actor: Actor, draftReportId: string, comments?: string) {
  assert(actor, "release");
  const r = await loadReport(draftReportId);
  if (r.status !== "SENT_FOR_QA" || r.qaReview?.status !== "APPROVED") {
    throw new ReleaseError("CONFLICT", "Only a QA-approved report can be released — the required workflow cannot be bypassed.");
  }
  const rel = await ensureReleaseRow(draftReportId);
  if (rel.status === "RELEASED") throw new ReleaseError("CONFLICT", "This report has already been released.");

  const now = new Date();
  await prisma.reportRelease.update({ where: { id: rel.id }, data: { status: "RELEASED", releasedAt: now, releasedById: actor.id, comments: comments ?? "", returnReason: null, updatedAt: now } });
  await logAudit(actor.id, { action: "REPORT_RELEASED", module: "report-release", entityType: "draftReport", entityId: draftReportId, oldValue: { status: rel.status }, newValue: { status: "RELEASED", releasedBy: actor.id } });

  // Released samples enter retention per the existing workflow.
  if (r.sampleRegistration) await ensureRetentionRecord(actor.id, r.sampleRegistration.id, r.trfId, r.customerId);

  return { ok: true as const };
}

export async function returnReportFromRelease(actor: Actor, draftReportId: string, reason: string) {
  assert(actor, "release");
  const errors = validateReturnReason(reason);
  if (Object.keys(errors).length) throw new ReleaseError("VALIDATION", "A reason is required.", errors);

  const r = await loadReport(draftReportId);
  const rel = await ensureReleaseRow(draftReportId);
  if (rel.status === "RELEASED") throw new ReleaseError("CONFLICT", "A released report is locked — use the Corrections & Amendments workflow instead.");

  const now = new Date();
  // Send it back to DRAFT so the preparer/QA cycle can run again.
  await prisma.draftReport.update({ where: { id: draftReportId }, data: { status: "DRAFT", updatedAt: now } });
  await prisma.reportRelease.update({ where: { id: rel.id }, data: { status: "RETURNED", returnReason: reason, updatedAt: now } });
  await logAudit(actor.id, { action: "REPORT_RELEASE_RETURNED", module: "report-release", entityType: "draftReport", entityId: draftReportId, oldValue: { status: rel.status }, newValue: { status: "RETURNED", reason } });
  return { ok: true as const };
}

export async function getReleaseHistory(actor: Actor, draftReportId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "report-release", entityId: draftReportId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}

export async function isReleaseLocked(draftReportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rel = await prisma.reportRelease.findFirst({ where: { draftReportId } }) as any;
  return rel?.status === "RELEASED";
}
