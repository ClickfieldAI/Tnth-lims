// Technical Review service layer — authoritative server-side logic for
// Module 5. Mirrors lib/receipts/service.ts: server actions call into this,
// never the other way around.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ReviewError, canReview, type Actor } from "./access";
import { validateAssessment, assessmentComplete, type TechnicalAssessmentInput } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canReview>[1]) {
  if (!canReview(actor, cap)) throw new ReviewError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadTrfForReview(trfId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = await prisma.trf.findUnique({
    where: { id: trfId },
    include: {
      customer: true, quotation: true,
      samples: { include: { tests: true, receipt: { include: { receivedBy: true } }, technicalReview: { include: { reviewedBy: true } } } },
    },
  }) as any;
  if (!t) throw new ReviewError("NOT_FOUND", "TRF not found.");
  return t;
}

function ensureReceiptConfirmed(t: { receiptConfirmedAt: Date | null }) {
  if (!t.receiptConfirmedAt) throw new ReviewError("CONFLICT", "Technical review can only begin once sample receipt has been confirmed for this TRF.");
}

async function ensureReviewRow(trfId: string, trfSampleId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review) {
    const now = new Date();
    review = await prisma.technicalReview.create({
      data: {
        trfId, trfSampleId, status: "PENDING",
        labelingSatisfactory: "Not Assessed", quantitySufficient: "Not Assessed", packagingSatisfactory: "Not Assessed",
        sampleConditionSatisfactory: "Not Assessed", testRequestComplete: "Not Assessed", assessmentNotes: "",
        holdReason: null, rejectionReason: null, clarificationComments: null,
        reviewedById: null, reviewedAt: null, createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }
  return review;
}

async function recordHistory(technicalReviewId: string, trfId: string, actorId: string | null, action: string, fromStatus: string, toStatus: string, comment?: string | null) {
  await prisma.technicalReviewHistory.create({ data: { technicalReviewId, trfId, action, actorId, comment: comment ?? null, fromStatus, toStatus, createdAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export interface ReviewQueueParams {
  search?: string; reviewStatus?: string; receiptStatus?: string; customerId?: string; trfId?: string;
  page?: number; pageSize?: number;
}

export async function listReviewQueue(actor: Actor, params: ReviewQueueParams) {
  assert(actor, "view");
  // Only samples whose TRF has confirmed receipt are eligible for review.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trfs: any[] = await prisma.trf.findMany({
    where: { receiptConfirmedAt: { not: null } },
    include: { customer: true, quotation: true, samples: { include: { receipt: true, technicalReview: true } } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  for (const t of trfs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of t.samples as any[]) {
      rows.push({
        trfId: t.id, trfCode: t.trfCode, customer: t.customer, quotation: t.quotation,
        receiptStatus: t.receiptStatus, sample: s, reviewStatus: s.technicalReview?.status ?? "PENDING",
      });
    }
  }

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.trfCode, r.customer?.name, r.customer?.code, r.sample.sampleName].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.reviewStatus) rows = rows.filter((r) => r.reviewStatus === params.reviewStatus);
  if (params.receiptStatus) rows = rows.filter((r) => r.receiptStatus === params.receiptStatus);
  if (params.customerId) rows = rows.filter((r) => r.customer?.id === params.customerId);
  if (params.trfId) rows = rows.filter((r) => r.trfId === params.trfId);

  rows.sort((a, b) => String(b.trfCode).localeCompare(String(a.trfCode)));

  const total = rows.length;
  const pageSize = params.pageSize ?? 10;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => r.reviewStatus === "PENDING").length,
      underReview: rows.filter((r) => r.reviewStatus === "UNDER_REVIEW").length,
      accepted: rows.filter((r) => r.reviewStatus === "ACCEPTED").length,
      onHold: rows.filter((r) => r.reviewStatus === "ON_HOLD").length,
      rejected: rows.filter((r) => r.reviewStatus === "REJECTED").length,
    },
  };
}

export async function getTrfForReview(actor: Actor, trfId: string) {
  assert(actor, "view");
  const t = await loadTrfForReview(trfId);
  return t;
}

// ---------------------------------------------------------------------------
// Assessment & decisions
// ---------------------------------------------------------------------------

export async function saveAssessment(actor: Actor, trfId: string, trfSampleId: string, input: TechnicalAssessmentInput) {
  assert(actor, "assess");
  const t = await loadTrfForReview(trfId);
  ensureReceiptConfirmed(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sample = (t.samples as any[]).find((s) => s.id === trfSampleId);
  if (!sample) throw new ReviewError("NOT_FOUND", "Sample not found on this TRF.");
  if (!sample.receipt) throw new ReviewError("CONFLICT", "This sample has not been received yet.");

  const review = sample.technicalReview ?? await ensureReviewRow(trfId, trfSampleId);
  if (["ACCEPTED", "REJECTED"].includes(review.status)) throw new ReviewError("CONFLICT", `Cannot change the assessment of a ${review.status.toLowerCase()} review.`);

  const errors = validateAssessment(input);
  if (Object.keys(errors).length) throw new ReviewError("VALIDATION", "Please rate every assessment item.", errors);

  const now = new Date();
  const wasUnderReview = review.status === "UNDER_REVIEW";
  await prisma.technicalReview.update({
    where: { id: review.id },
    data: {
      labelingSatisfactory: input.labelingSatisfactory, quantitySufficient: input.quantitySufficient,
      packagingSatisfactory: input.packagingSatisfactory, sampleConditionSatisfactory: input.sampleConditionSatisfactory,
      testRequestComplete: input.testRequestComplete, assessmentNotes: input.assessmentNotes ?? "",
      status: review.status === "PENDING" ? "UNDER_REVIEW" : review.status, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  if (!wasUnderReview && review.status === "PENDING") {
    await recordHistory(review.id, trfId, actor.id, "ASSESSMENT_RECORDED", "PENDING", "UNDER_REVIEW");
  }
  await logAudit(actor.id, { action: "TECHNICAL_ASSESSMENT_SAVED", module: "technical-review", entityType: "trf", entityId: trfId, oldValue: null, newValue: { trfSampleId, ...input } });
  return { ok: true as const, id: review.id };
}

async function requireCompleteAssessment(trfId: string, trfSampleId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review) throw new ReviewError("CONFLICT", "Record the technical assessment before making a decision.");
  const complete = assessmentComplete({
    labelingSatisfactory: review.labelingSatisfactory, quantitySufficient: review.quantitySufficient,
    packagingSatisfactory: review.packagingSatisfactory, sampleConditionSatisfactory: review.sampleConditionSatisfactory,
    testRequestComplete: review.testRequestComplete,
  });
  if (!complete) throw new ReviewError("VALIDATION", "Rate every assessment item before making a decision.");
  return review;
}

export async function acceptSampleReview(actor: Actor, trfId: string, trfSampleId: string) {
  assert(actor, "decide");
  const t = await loadTrfForReview(trfId);
  ensureReceiptConfirmed(t);
  const review = await requireCompleteAssessment(trfId, trfSampleId);
  if (!["UNDER_REVIEW", "ON_HOLD", "CLARIFICATION_REQUESTED"].includes(review.status)) throw new ReviewError("CONFLICT", `Cannot accept a review in ${review.status} status.`);

  await prisma.technicalReview.update({ where: { id: review.id }, data: { status: "ACCEPTED", reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() } });
  await recordHistory(review.id, trfId, actor.id, "ACCEPTED", review.status, "ACCEPTED");
  await logAudit(actor.id, { action: "TECHNICAL_REVIEW_ACCEPTED", module: "technical-review", entityType: "trf", entityId: trfId, oldValue: { status: review.status }, newValue: { status: "ACCEPTED", trfSampleId } });
  return { ok: true as const };
}

export async function holdSampleReview(actor: Actor, trfId: string, trfSampleId: string, reason: string) {
  assert(actor, "decide");
  if (!reason.trim()) throw new ReviewError("VALIDATION", "A reason is required to place a review on hold.", { reason: "Required" });
  const t = await loadTrfForReview(trfId);
  ensureReceiptConfirmed(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review || !["UNDER_REVIEW", "CLARIFICATION_REQUESTED"].includes(review.status)) throw new ReviewError("CONFLICT", "Only a review currently under review can be placed on hold.");

  await prisma.technicalReview.update({ where: { id: review.id }, data: { status: "ON_HOLD", holdReason: reason, updatedAt: new Date() } });
  await recordHistory(review.id, trfId, actor.id, "ON_HOLD", review.status, "ON_HOLD", reason);
  await logAudit(actor.id, { action: "TECHNICAL_REVIEW_ON_HOLD", module: "technical-review", entityType: "trf", entityId: trfId, oldValue: { status: review.status }, newValue: { status: "ON_HOLD", reason, trfSampleId } });
  return { ok: true as const };
}

export async function resumeSampleReview(actor: Actor, trfId: string, trfSampleId: string) {
  assert(actor, "decide");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review || review.status !== "ON_HOLD") throw new ReviewError("CONFLICT", "Only a review on hold can be resumed.");

  await prisma.technicalReview.update({ where: { id: review.id }, data: { status: "UNDER_REVIEW", holdReason: null, updatedAt: new Date() } });
  await recordHistory(review.id, trfId, actor.id, "REVIEW_RESUMED", "ON_HOLD", "UNDER_REVIEW");
  await logAudit(actor.id, { action: "TECHNICAL_REVIEW_RESUMED", module: "technical-review", entityType: "trf", entityId: trfId, oldValue: { status: "ON_HOLD" }, newValue: { status: "UNDER_REVIEW", trfSampleId } });
  return { ok: true as const };
}

export async function rejectSampleReview(actor: Actor, trfId: string, trfSampleId: string, reason: string) {
  assert(actor, "decide");
  if (!reason.trim()) throw new ReviewError("VALIDATION", "A reason is required to reject a review.", { reason: "Required" });
  const t = await loadTrfForReview(trfId);
  ensureReceiptConfirmed(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review || !["UNDER_REVIEW", "ON_HOLD", "CLARIFICATION_REQUESTED"].includes(review.status)) throw new ReviewError("CONFLICT", `Cannot reject a review in ${review?.status ?? "PENDING"} status.`);

  await prisma.technicalReview.update({ where: { id: review.id }, data: { status: "REJECTED", rejectionReason: reason, updatedAt: new Date() } });
  await recordHistory(review.id, trfId, actor.id, "REJECTED", review.status, "REJECTED", reason);
  await logAudit(actor.id, { action: "TECHNICAL_REVIEW_REJECTED", module: "technical-review", entityType: "trf", entityId: trfId, oldValue: { status: review.status }, newValue: { status: "REJECTED", reason, trfSampleId } });
  return { ok: true as const };
}

export async function requestSampleClarification(actor: Actor, trfId: string, trfSampleId: string, comment: string) {
  assert(actor, "decide");
  if (!comment.trim()) throw new ReviewError("VALIDATION", "A comment is required to request clarification.", { comment: "Required" });
  const t = await loadTrfForReview(trfId);
  ensureReceiptConfirmed(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review || review.status !== "UNDER_REVIEW") throw new ReviewError("CONFLICT", "Clarification can only be requested while a review is under review.");

  await prisma.technicalReview.update({ where: { id: review.id }, data: { status: "CLARIFICATION_REQUESTED", clarificationComments: comment, updatedAt: new Date() } });
  await recordHistory(review.id, trfId, actor.id, "CLARIFICATION_REQUESTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED", comment);
  await logAudit(actor.id, { action: "TECHNICAL_REVIEW_CLARIFICATION_REQUESTED", module: "technical-review", entityType: "trf", entityId: trfId, oldValue: null, newValue: { comment, trfSampleId } });
  return { ok: true as const };
}

export async function getReviewHistory(actor: Actor, trfSampleId: string) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const review = await prisma.technicalReview.findFirst({ where: { trfSampleId } }) as any;
  if (!review) return [];
  return prisma.technicalReviewHistory.findMany({ where: { technicalReviewId: review.id }, include: { actor: true } });
}

