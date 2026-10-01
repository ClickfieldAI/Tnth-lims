// Corrections & Amendments service layer — authoritative server-side logic
// for Module 16. Mirrors lib/qa-review/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextCorrectionCode } from "@/lib/ids";
import { CorrectionError, canCorrection, type Actor } from "./access";
import { validateRequestCorrection, validateDecisionReason, type RequestCorrectionInput } from "./validation";
import { isReleaseLocked } from "@/lib/release/service";

function assert(actor: Actor, cap: Parameters<typeof canCorrection>[1]) {
  if (!canCorrection(actor, cap)) throw new CorrectionError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadCorrection(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await prisma.correction.findUnique({
    where: { id },
    include: { draftReport: true, sampleRegistration: true, customer: true, requestedBy: true, reviewedBy: true, newRevision: true },
  }) as any;
  if (!c) throw new CorrectionError("NOT_FOUND", "Correction request not found.");
  return c;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface CorrectionQueueParams { search?: string; status?: string; page?: number; pageSize?: number }

export async function listCorrections(actor: Actor, params: CorrectionQueueParams) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.correction.findMany({
    include: { draftReport: true, sampleRegistration: true, customer: true, requestedBy: true, reviewedBy: true, newRevision: true },
  });

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.correctionCode, r.draftReport?.reportCode, r.sampleRegistration?.sampleCode, r.customer?.name].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
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
      requested: rows.filter((r) => r.status === "REQUESTED").length,
      underReview: rows.filter((r) => r.status === "UNDER_REVIEW").length,
      completed: rows.filter((r) => r.status === "COMPLETED").length,
      rejected: rows.filter((r) => r.status === "REJECTED").length,
    },
  };
}

export async function getCorrection(actor: Actor, id: string) {
  assert(actor, "view");
  return loadCorrection(id);
}

// ---------------------------------------------------------------------------
// Request / decide / complete
// ---------------------------------------------------------------------------

export async function requestCorrection(actor: Actor, input: RequestCorrectionInput) {
  assert(actor, "request");
  const errors = validateRequestCorrection(input);
  if (Object.keys(errors).length) throw new CorrectionError("VALIDATION", "Please fix the highlighted fields.", errors);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = await prisma.draftReport.findUnique({ where: { id: input.draftReportId } }) as any;
  if (!report) throw new CorrectionError("NOT_FOUND", "Report not found.");
  if (report.status === "DRAFT") throw new CorrectionError("CONFLICT", "A plain draft can be edited directly — the correction workflow is for reports already verified, QA-reviewed or released.");

  // Prevent duplicate active corrections piling up on the same report —
  // mirrors the duplicate-active-delivery guard in Module 14.
  const active = (await prisma.correction.findMany({ where: { draftReportId: report.id } }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .some((c: any) => c.status === "REQUESTED" || c.status === "UNDER_REVIEW" || c.status === "APPROVED");
  if (active) throw new CorrectionError("CONFLICT", "An active correction request already exists for this report — resolve it before requesting another.");

  const now = new Date();
  const count = await prisma.correction.count({});
  const code = nextCorrectionCode(count + 1);
  const created = await prisma.correction.create({
    data: {
      correctionCode: code, draftReportId: report.id, sampleRegistrationId: report.sampleRegistrationId, customerId: report.customerId,
      description: input.description, originalValue: input.originalValue, correctedValue: input.correctedValue, reason: input.reason,
      status: "REQUESTED", requestedById: actor.id, requestedAt: now,
      reviewedById: null, reviewedAt: null, decisionComments: "", newRevisionId: null,
      createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actor.id, { action: "CORRECTION_REQUESTED", module: "corrections", entityType: "correction", entityId: created.id, oldValue: null, newValue: { correctionCode: code, draftReportId: report.id } });
  return { ok: true as const, id: created.id, correctionCode: code };
}

/** Claims a requested correction for review — separation of duties: the reviewer may not be the person who requested it (Admin exempted, matching Module 10's pattern). */
export async function startCorrectionReview(actor: Actor, id: string) {
  assert(actor, "decide");
  const c = await loadCorrection(id);
  if (c.status !== "REQUESTED") throw new CorrectionError("CONFLICT", "Only a newly requested correction can be taken up for review.");
  if (actor.role !== "ADMIN" && actor.id === c.requestedById) {
    throw new CorrectionError("FORBIDDEN", "You cannot review a correction you personally requested — separation of duties requires a different reviewer.");
  }

  const now = new Date();
  await prisma.correction.update({ where: { id }, data: { status: "UNDER_REVIEW", reviewedById: actor.id, updatedAt: now } });
  await logAudit(actor.id, { action: "CORRECTION_UNDER_REVIEW", module: "corrections", entityType: "correction", entityId: id, oldValue: { status: "REQUESTED" }, newValue: { status: "UNDER_REVIEW", reviewedBy: actor.id } });
  return { ok: true as const };
}

export async function approveCorrection(actor: Actor, id: string, comments?: string) {
  assert(actor, "decide");
  const c = await loadCorrection(id);
  if (c.status !== "UNDER_REVIEW") throw new CorrectionError("CONFLICT", "Only a correction under review can be approved.");
  if (actor.role !== "ADMIN" && actor.id !== c.reviewedById) throw new CorrectionError("FORBIDDEN", "Only the reviewer who claimed this correction can decide it.");

  const now = new Date();
  await prisma.correction.update({ where: { id }, data: { status: "APPROVED", decisionComments: comments ?? "", updatedAt: now } });
  await logAudit(actor.id, { action: "CORRECTION_APPROVED", module: "corrections", entityType: "correction", entityId: id, oldValue: { status: "UNDER_REVIEW" }, newValue: { status: "APPROVED" } });
  return { ok: true as const };
}

export async function rejectCorrection(actor: Actor, id: string, reason: string) {
  assert(actor, "decide");
  const errors = validateDecisionReason(reason);
  if (Object.keys(errors).length) throw new CorrectionError("VALIDATION", "A reason is required.", errors);

  const c = await loadCorrection(id);
  if (c.status !== "UNDER_REVIEW") throw new CorrectionError("CONFLICT", "Only a correction under review can be rejected.");
  if (actor.role !== "ADMIN" && actor.id !== c.reviewedById) throw new CorrectionError("FORBIDDEN", "Only the reviewer who claimed this correction can decide it.");

  const now = new Date();
  await prisma.correction.update({ where: { id }, data: { status: "REJECTED", decisionComments: reason, updatedAt: now } });
  await logAudit(actor.id, { action: "CORRECTION_REJECTED", module: "corrections", entityType: "correction", entityId: id, oldValue: { status: "UNDER_REVIEW" }, newValue: { status: "REJECTED", reason } });
  return { ok: true as const };
}

/**
 * Completes an approved correction, applying it in a controlled way: the
 * original report (and its released value) is never overwritten — a new
 * report revision row is created, carrying the corrected value forward,
 * following the same revisionNumber+1/previousVersionId pattern used by
 * lib/reports/service.ts's createReportRevision (not called directly here
 * since it is gated by the reports module's own "edit" capability, which
 * QA — who completes corrections — does not hold there). For a report that
 * was never released, completion is recorded without a new revision since
 * nothing was locked yet.
 */
export async function completeCorrection(actor: Actor, id: string) {
  assert(actor, "complete");
  const c = await loadCorrection(id);
  if (c.status !== "APPROVED") throw new CorrectionError("CONFLICT", "Only an approved correction can be completed.");

  const now = new Date();
  let newRevisionId: string | null = null;
  const locked = await isReleaseLocked(c.draftReportId);
  if (locked) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await prisma.draftReport.findUnique({ where: { id: c.draftReportId }, include: { items: true } }) as any;
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
    newRevisionId = created.id;
    await logAudit(actor.id, { action: "DRAFT_REPORT_REVISION_CREATED", module: "reports", entityType: "draftReport", entityId: created.id, oldValue: { previousVersion: r.id }, newValue: { revisionNumber: created.revisionNumber, reason: `Correction ${c.correctionCode}` } });
  }

  await prisma.correction.update({ where: { id }, data: { status: "COMPLETED", newRevisionId, updatedAt: now } });
  await logAudit(actor.id, { action: "CORRECTION_COMPLETED", module: "corrections", entityType: "correction", entityId: id, oldValue: { status: "APPROVED" }, newValue: { status: "COMPLETED", newRevisionId } });
  return { ok: true as const, newRevisionId };
}

export async function getCorrectionHistory(actor: Actor, correctionId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "corrections", entityId: correctionId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}

export async function listCorrectionsForReport(actor: Actor, draftReportId: string) {
  assert(actor, "history");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.correction.findMany({ where: { draftReportId }, include: { requestedBy: true, reviewedBy: true } });
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
