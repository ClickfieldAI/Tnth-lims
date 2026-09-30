// QA Review service layer — authoritative server-side logic for Module 12.
// Mirrors lib/reports/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { QaReviewError, canQaReview, type Actor } from "./access";
import { validateReturnReason } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canQaReview>[1]) {
  if (!canQaReview(actor, cap)) throw new QaReviewError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadReview(draftReportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = await prisma.draftReport.findUnique({
    where: { id: draftReportId },
    include: {
      sampleRegistration: true, trf: true, customer: true, preparedBy: true,
      items: { include: { testAllocation: { include: { trfTestRequest: true, result: true } } } },
      qaReview: { include: { reviewer: true } },
    },
  }) as any;
  if (!report) throw new QaReviewError("NOT_FOUND", "Report not found.");
  return report;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface QaReviewQueueParams { search?: string; status?: string; page?: number; pageSize?: number }

export async function listQaReviewQueue(actor: Actor, params: QaReviewQueueParams) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.draftReport.findMany({
    where: { status: "SENT_FOR_QA" },
    include: { sampleRegistration: true, trf: true, customer: true, items: true, qaReview: { include: { reviewer: true } } },
  });

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.reportCode, r.sampleRegistration?.sampleCode, r.trf?.trfCode, r.customer?.name].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.qaReview?.status === params.status);
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => r.qaReview?.status === "PENDING").length,
      approved: rows.filter((r) => r.qaReview?.status === "APPROVED").length,
      returned: rows.filter((r) => r.qaReview?.status === "RETURNED").length,
    },
  };
}

export async function getReportForQaReview(actor: Actor, draftReportId: string) {
  assert(actor, "view");
  return loadReview(draftReportId);
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export async function approveReport(actor: Actor, draftReportId: string, comments?: string) {
  assert(actor, "decide");
  const r = await loadReview(draftReportId);
  if (r.status !== "SENT_FOR_QA") throw new QaReviewError("CONFLICT", "Only a report sent for QA review can be approved.");
  if (!r.qaReview || r.qaReview.status !== "PENDING") throw new QaReviewError("CONFLICT", "This report's QA review is not pending.");

  const now = new Date();
  await prisma.qaReview.update({ where: { id: r.qaReview.id }, data: { status: "APPROVED", reviewerId: actor.id, reviewedAt: now, comments: comments ?? "", returnReason: null, updatedAt: now } });
  await logAudit(actor.id, { action: "QA_REPORT_APPROVED", module: "qa-review", entityType: "draftReport", entityId: draftReportId, oldValue: { status: "PENDING" }, newValue: { status: "APPROVED" } });
  return { ok: true as const };
}

export async function returnReport(actor: Actor, draftReportId: string, reason: string) {
  assert(actor, "decide");
  const errors = validateReturnReason(reason);
  if (Object.keys(errors).length) throw new QaReviewError("VALIDATION", "A reason is required.", errors);

  const r = await loadReview(draftReportId);
  if (r.status !== "SENT_FOR_QA") throw new QaReviewError("CONFLICT", "Only a report sent for QA review can be returned.");
  if (!r.qaReview || r.qaReview.status !== "PENDING") throw new QaReviewError("CONFLICT", "This report's QA review is not pending.");

  const now = new Date();
  // Unlock the report back to DRAFT so the preparer can correct and resubmit it.
  await prisma.draftReport.update({ where: { id: draftReportId }, data: { status: "DRAFT", updatedAt: now } });
  await prisma.qaReview.update({ where: { id: r.qaReview.id }, data: { status: "RETURNED", reviewerId: actor.id, reviewedAt: now, returnReason: reason, updatedAt: now } });
  await logAudit(actor.id, { action: "QA_REPORT_RETURNED", module: "qa-review", entityType: "draftReport", entityId: draftReportId, oldValue: { status: "PENDING" }, newValue: { status: "RETURNED", reason } });
  return { ok: true as const };
}

export async function getQaReviewHistory(actor: Actor, draftReportId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "qa-review", entityId: draftReportId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}

/** True once a report has been fully QA-approved — any further change must go through a new revision, never an edit of this row. */
export async function isApprovalLocked(draftReportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await prisma.draftReport.findUnique({ where: { id: draftReportId }, include: { qaReview: true } }) as any;
  return r?.qaReview?.status === "APPROVED";
}
