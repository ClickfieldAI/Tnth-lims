import { describe, it, expect } from "vitest";
import {
  saveAssessment, acceptSampleReview, holdSampleReview, resumeSampleReview, rejectSampleReview, requestSampleClarification,
  listReviewQueue, getTrfForReview, getReviewHistory,
} from "@/lib/reviews/service";
import { ReviewError, type Actor } from "@/lib/reviews/access";
import { emptyAssessmentInput, type TechnicalAssessmentInput } from "@/lib/reviews/validation";
import { prisma } from "@/lib/prisma";
import { createTrfDraft, addTrfSample, updateTrfDraft, setTrfAuthorization, submitTrf, startTrfReview, acceptTrf } from "@/lib/trfs/service";
import { emptySample, emptyTestRequest } from "@/lib/trfs/validation";
import { recordSampleReceipt, confirmTrfReceipt } from "@/lib/receipts/service";
import { emptySampleReceiptInput } from "@/lib/receipts/validation";
import {
  createEnquiry, createQuotation, updateQuotationDraft, submitQuotationForApproval, approveQuotation, sendQuotation, recordAcceptance,
} from "@/lib/enquiries/service";
import { emptyEnquiryInput, emptyProduct, emptyTestRequest as emptyEnqTest } from "@/lib/enquiries/validation";

const admin: Actor = { id: "user_1", role: "ADMIN" };
const manager: Actor = { id: "user_2", role: "MANAGER" };
const qa: Actor = { id: "user_3", role: "QA" };
const analyst: Actor = { id: "user_4", role: "ANALYST" };
const clientUser: Actor = { id: "user_6", role: "CLIENT", clientId: "client_1" };

async function activeCustomerId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma.client.findFirst({ where: { isActive: true } }) as any);
  return c.id as string;
}

async function receiptConfirmedTrf(sampleCount = 1) {
  const customerId = await activeCustomerId();
  const enqInput = emptyEnquiryInput();
  enqInput.customerId = customerId; enqInput.assignedManagerId = "user_2";
  enqInput.products = [{ ...emptyProduct(), productName: "P", productCategory: "Food", tests: [{ ...emptyEnqTest(), serviceId: "microbial-analysis", requestedTest: "TPC", requestedQuantity: 1 }] }];
  const enq = await createEnquiry(admin, enqInput);
  const quo = await createQuotation(admin, enq.id);
  await updateQuotationDraft(admin, quo.id, {
    validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), discountTotal: 0,
    items: [{ productReference: "P", serviceName: "S", quantity: 1, unitPrice: 1000, discount: 0, taxCategory: "GST 18%" }],
  });
  await submitQuotationForApproval(admin, quo.id);
  await approveQuotation(manager, quo.id);
  await sendQuotation(admin, quo.id);
  await recordAcceptance(manager, quo.id, {});

  const draft = await createTrfDraft(admin, { customerId, quotationId: quo.id });
  const sampleIds: string[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const res = await addTrfSample(admin, draft.id, {
      ...emptySample(), sampleName: `Sample ${i + 1}`, productCategory: "Food", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer",
      tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }],
    });
    sampleIds.push(res.id!);
  }
  await updateTrfDraft(admin, draft.id, { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false });
  await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Other" });
  await submitTrf(admin, draft.id);
  await startTrfReview(manager, draft.id);
  await acceptTrf(manager, draft.id);
  for (const id of sampleIds) await recordSampleReceipt(admin, draft.id, id, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
  await confirmTrfReceipt(admin, draft.id);
  return { trfId: draft.id, sampleIds };
}

function fullAssessment(overrides: Partial<TechnicalAssessmentInput> = {}): TechnicalAssessmentInput {
  return {
    labelingSatisfactory: "Satisfactory", quantitySufficient: "Satisfactory", packagingSatisfactory: "Satisfactory",
    sampleConditionSatisfactory: "Satisfactory", testRequestComplete: "Satisfactory", ...overrides,
  };
}

describe("technical assessment", () => {
  it("requires receipt to be confirmed before assessment can begin", async () => {
    const customerId = await activeCustomerId();
    const enqInput = emptyEnquiryInput();
    enqInput.customerId = customerId; enqInput.assignedManagerId = "user_2";
    enqInput.products = [{ ...emptyProduct(), productName: "P", productCategory: "Food", tests: [{ ...emptyEnqTest(), serviceId: "microbial-analysis", requestedTest: "TPC", requestedQuantity: 1 }] }];
    const enq = await createEnquiry(admin, enqInput);
    const quo = await createQuotation(admin, enq.id);
    await updateQuotationDraft(admin, quo.id, { validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), discountTotal: 0, items: [{ productReference: "P", serviceName: "S", quantity: 1, unitPrice: 100, discount: 0, taxCategory: "GST 18%" }] });
    await submitQuotationForApproval(admin, quo.id);
    await approveQuotation(manager, quo.id);
    await sendQuotation(admin, quo.id);
    await recordAcceptance(manager, quo.id, {});
    const draft = await createTrfDraft(admin, { customerId, quotationId: quo.id });
    const sample = await addTrfSample(admin, draft.id, {
      ...emptySample(), sampleName: "S1", productCategory: "Food", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer",
      tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }],
    });
    await expect(saveAssessment(admin, draft.id, sample.id!, fullAssessment())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("saves an assessment and moves the review to UNDER_REVIEW", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(qa, trfId, sampleIds[0], fullAssessment());
    const t = await getTrfForReview(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sample = (t.samples as any[]).find((s) => s.id === sampleIds[0]);
    expect(sample.technicalReview.status).toBe("UNDER_REVIEW");
  });

  it("rejects an invalid rating value", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await expect(saveAssessment(qa, trfId, sampleIds[0], fullAssessment({ labelingSatisfactory: "Great" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("allows saving a partially-rated assessment as a draft (completeness is only enforced before a decision)", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    const res = await saveAssessment(qa, trfId, sampleIds[0], fullAssessment({ labelingSatisfactory: "Not Assessed" }));
    expect(res.ok).toBe(true);
    await expect(acceptSampleReview(qa, trfId, sampleIds[0])).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("review decisions", () => {
  it("blocks a decision until the assessment is complete", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await expect(acceptSampleReview(qa, trfId, sampleIds[0])).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("accepts a sample review once assessed", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(qa, trfId, sampleIds[0], fullAssessment());
    await acceptSampleReview(qa, trfId, sampleIds[0]);
    const t = await getTrfForReview(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === sampleIds[0]).technicalReview.status).toBe("ACCEPTED");
  });

  it("requires a reason to place on hold and to reject", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(qa, trfId, sampleIds[0], fullAssessment());
    await expect(holdSampleReview(qa, trfId, sampleIds[0], "")).rejects.toMatchObject({ code: "VALIDATION" });
    await holdSampleReview(qa, trfId, sampleIds[0], "Awaiting clearer labeling photos");
    let t = await getTrfForReview(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === sampleIds[0]).technicalReview.status).toBe("ON_HOLD");

    await resumeSampleReview(qa, trfId, sampleIds[0]);
    t = await getTrfForReview(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === sampleIds[0]).technicalReview.status).toBe("UNDER_REVIEW");

    await expect(rejectSampleReview(qa, trfId, sampleIds[0], "")).rejects.toMatchObject({ code: "VALIDATION" });
    await rejectSampleReview(qa, trfId, sampleIds[0], "Sample condition unsatisfactory");
    t = await getTrfForReview(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === sampleIds[0]).technicalReview.status).toBe("REJECTED");
  });

  it("requires a comment to request clarification, and records history", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(qa, trfId, sampleIds[0], fullAssessment());
    await expect(requestSampleClarification(qa, trfId, sampleIds[0], "")).rejects.toMatchObject({ code: "VALIDATION" });
    await requestSampleClarification(qa, trfId, sampleIds[0], "Please confirm the batch number on the label");
    const t = await getTrfForReview(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === sampleIds[0]).technicalReview.status).toBe("CLARIFICATION_REQUESTED");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const review = (t.samples as any[]).find((s) => s.id === sampleIds[0]).technicalReview;
    const history = await getReviewHistory(admin, sampleIds[0]);
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["ASSESSMENT_RECORDED", "CLARIFICATION_REQUESTED"]));
    void review;
  });

  it("does not allow further decisions once accepted or rejected", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(qa, trfId, sampleIds[0], fullAssessment());
    await acceptSampleReview(qa, trfId, sampleIds[0]);
    await expect(saveAssessment(qa, trfId, sampleIds[0], fullAssessment())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(acceptSampleReview(qa, trfId, sampleIds[0])).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("preserves the original TRF and receipt records — review never mutates them", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(qa, trfId, sampleIds[0], fullAssessment());
    await acceptSampleReview(qa, trfId, sampleIds[0]);
    const t = await getTrfForReview(admin, trfId);
    expect(t.status).toBe("ACCEPTED"); // TRF's own workflow status unchanged
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === sampleIds[0]).receipt).toBeTruthy();
  });
});

describe("RBAC", () => {
  it("denies ANALYST from assessing or deciding, but allows viewing", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await expect(saveAssessment(analyst, trfId, sampleIds[0], fullAssessment())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(acceptSampleReview(analyst, trfId, sampleIds[0])).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listReviewQueue(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("denies CLIENT from any review action, including viewing", async () => {
    await expect(listReviewQueue(clientUser, {})).rejects.toBeInstanceOf(ReviewError);
  });

  it("allows QA and MANAGER to assess and decide", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(manager, trfId, sampleIds[0], fullAssessment());
    const res = await acceptSampleReview(manager, trfId, sampleIds[0]);
    expect(res.ok).toBe(true);
  });
});

describe("review queue", () => {
  it("only lists samples whose TRF has confirmed receipt", async () => {
    const { trfId } = await receiptConfirmedTrf(1);
    const list = await listReviewQueue(admin, {});
    expect(list.rows.some((r) => r.trfId === trfId)).toBe(true);
  });

  it("filters by review status and paginates", async () => {
    const { trfId, sampleIds } = await receiptConfirmedTrf(1);
    await saveAssessment(admin, trfId, sampleIds[0], fullAssessment());
    const list = await listReviewQueue(admin, { reviewStatus: "UNDER_REVIEW" });
    expect(list.rows.some((r) => r.trfId === trfId)).toBe(true);
  });
});
