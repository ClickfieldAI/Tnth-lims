import { describe, it, expect } from "vitest";
import { verifyResult, returnResult, listVerificationQueue, getResultForVerification } from "@/lib/verification/service";
import { VerificationError, type Actor } from "@/lib/verification/access";
import { saveResult, completeResult, correctResult } from "@/lib/result-entry/service";
import { emptyResultEntryInput } from "@/lib/result-entry/validation";
import { createWorksheet, assignWorksheet, prepareWorksheet } from "@/lib/worksheets/service";
import { allocateTest } from "@/lib/allocation/service";
import { emptyAllocateTestInput } from "@/lib/allocation/validation";
import { prisma } from "@/lib/prisma";
import { createTrfDraft, addTrfSample, updateTrfDraft, setTrfAuthorization, submitTrf, startTrfReview, acceptTrf } from "@/lib/trfs/service";
import { emptySample, emptyTestRequest } from "@/lib/trfs/validation";
import { recordSampleReceipt, confirmTrfReceipt } from "@/lib/receipts/service";
import { emptySampleReceiptInput } from "@/lib/receipts/validation";
import { saveAssessment, acceptSampleReview } from "@/lib/reviews/service";
import { registerSample } from "@/lib/registration/service";
import { emptyRegisterSampleInput } from "@/lib/registration/validation";
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

const fullAssessment = {
  labelingSatisfactory: "Satisfactory", quantitySufficient: "Satisfactory", packagingSatisfactory: "Satisfactory",
  sampleConditionSatisfactory: "Satisfactory", testRequestComplete: "Satisfactory",
} as const;

async function completedTestResultId() {
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
  const sample = await addTrfSample(admin, draft.id, { ...emptySample(), sampleName: "Sample A", productCategory: "Food", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer", tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }] });
  await updateTrfDraft(admin, draft.id, { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false });
  await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Other" });
  await submitTrf(admin, draft.id);
  await startTrfReview(manager, draft.id);
  await acceptTrf(manager, draft.id);
  await recordSampleReceipt(admin, draft.id, sample.id!, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
  await confirmTrfReceipt(admin, draft.id);
  await saveAssessment(qa, draft.id, sample.id!, fullAssessment);
  await acceptSampleReview(qa, draft.id, sample.id!);
  await registerSample(admin, sample.id!, emptyRegisterSampleInput());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = await prisma.trfSample.findUnique({ where: { id: sample.id! }, include: { tests: true } }) as any;
  const alloc = await allocateTest(admin, s.tests[0].id, { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
  const ws = await createWorksheet(admin, { testAllocationIds: [alloc.id] });
  await prepareWorksheet(admin, ws.id);
  await assignWorksheet(admin, ws.id);
  const result = await saveResult(analyst, alloc.id, { ...emptyResultEntryInput(), resultValue: "45", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10) });
  await completeResult(analyst, alloc.id);
  return { testResultId: result.id, testAllocationId: alloc.id };
}

describe("verification", () => {
  it("verifies a completed result", async () => {
    const { testResultId } = await completedTestResultId();
    const res = await verifyResult(qa, testResultId, "Reviewed against spec, within limits.");
    expect(res.ok).toBe(true);
    const list = await listVerificationQueue(admin, { status: "VERIFIED" });
    expect(list.rows.some((r) => r.testResultId === testResultId)).toBe(true);
  });

  it("rejects verifying an incomplete (not-yet-completed) result", async () => {
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
    const sample = await addTrfSample(admin, draft.id, { ...emptySample(), sampleName: "S", productCategory: "F", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer", tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }] });
    await updateTrfDraft(admin, draft.id, { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false });
    await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Other" });
    await submitTrf(admin, draft.id);
    await startTrfReview(manager, draft.id);
    await acceptTrf(manager, draft.id);
    await recordSampleReceipt(admin, draft.id, sample.id!, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
    await confirmTrfReceipt(admin, draft.id);
    await saveAssessment(qa, draft.id, sample.id!, fullAssessment);
    await acceptSampleReview(qa, draft.id, sample.id!);
    await registerSample(admin, sample.id!, emptyRegisterSampleInput());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await prisma.trfSample.findUnique({ where: { id: sample.id! }, include: { tests: true } }) as any;
    const alloc = await allocateTest(admin, s.tests[0].id, { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
    const ws = await createWorksheet(admin, { testAllocationIds: [alloc.id] });
    await prepareWorksheet(admin, ws.id);
    await assignWorksheet(admin, ws.id);
    const result = await saveResult(analyst, alloc.id, { ...emptyResultEntryInput(), resultValue: "45", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10) });
    // never completed
    await expect(verifyResult(qa, result.id, "")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces separation of duties — the analyst who entered the result cannot verify it", async () => {
    const { testResultId } = await completedTestResultId(); // entered/completed by user_4 (ANALYST)
    await expect(verifyResult(analyst, testResultId, "")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows ADMIN to verify regardless (exempt like elsewhere in this app)", async () => {
    const { testResultId } = await completedTestResultId();
    const res = await verifyResult(admin, testResultId);
    expect(res.ok).toBe(true);
  });
});

describe("return for correction", () => {
  it("requires a reason and reopens the result for correction", async () => {
    const { testResultId, testAllocationId } = await completedTestResultId();
    await expect(returnResult(qa, testResultId, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await returnResult(qa, testResultId, "Result value looks transposed — please re-check.");
    const r = await getResultForVerification(admin, testResultId);
    expect(r.status).toBe("IN_PROGRESS");
    // analyst can now correct and re-complete
    await saveResult(analyst, testAllocationId, { ...emptyResultEntryInput(), resultValue: "50", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10) });
    await completeResult(analyst, testAllocationId);
    const list = await listVerificationQueue(admin, {});
    expect(list.rows.find((row) => row.testResultId === testResultId)?.status).toBe("PENDING");
  });
});

describe("locking and correction reopening verification", () => {
  it("locks a verified result, and correcting it (Admin/Manager only) reopens verification to PENDING", async () => {
    const { testResultId, testAllocationId } = await completedTestResultId();
    await verifyResult(qa, testResultId);
    let r = await getResultForVerification(admin, testResultId);
    expect(r.verification.status).toBe("VERIFIED");

    await correctResult(manager, testAllocationId, { ...emptyResultEntryInput(), resultValue: "60", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10) }, "Audit found transcription error");
    r = await getResultForVerification(admin, testResultId);
    expect(r.verification.status).toBe("PENDING");
  });

  it("rejects returning an already-verified result directly", async () => {
    const { testResultId } = await completedTestResultId();
    await verifyResult(qa, testResultId);
    await expect(returnResult(qa, testResultId, "reason")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("RBAC", () => {
  it("denies CLIENT from any verification access", async () => {
    await expect(listVerificationQueue(clientUser, {})).rejects.toBeInstanceOf(VerificationError);
  });

  it("allows ANALYST to view only their own results, but not verify", async () => {
    const { testResultId } = await completedTestResultId();
    await expect(verifyResult(analyst, testResultId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listVerificationQueue(analyst, {});
    expect(list.rows.some((r) => r.testResultId === testResultId)).toBe(true);
  });
});

describe("audit", () => {
  it("records RESULT_VERIFIED and RESULT_RETURNED events", async () => {
    const { testResultId } = await completedTestResultId();
    const v = await verifyResult(qa, testResultId);
    const history = await prisma.auditLog.findMany({ where: { module: "technical-verification", entityId: v.id } });
    expect(history.some((h) => h.action === "RESULT_VERIFIED")).toBe(true);
  });
});
