import { describe, it, expect } from "vitest";
import { saveResult, completeResult, correctResult, listTestingQueue, getAllocationForTesting } from "@/lib/result-entry/service";
import { ResultEntryError, type Actor } from "@/lib/result-entry/access";
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
const otherAnalyst: Actor = { id: "user_5", role: "MICRO" };
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

async function assignedTestAllocationId() {
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
  const testRequestId = s.tests[0].id;
  const alloc = await allocateTest(admin, testRequestId, { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
  const ws = await createWorksheet(admin, { testAllocationIds: [alloc.id] });
  await prepareWorksheet(admin, ws.id);
  await assignWorksheet(admin, ws.id);
  return alloc.id;
}

function validInput(overrides = {}) {
  return { ...emptyResultEntryInput(), resultValue: "45", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10), ...overrides };
}

describe("result entry", () => {
  it("enters a result on an assigned worksheet test, moving it to IN_PROGRESS", async () => {
    const allocId = await assignedTestAllocationId();
    const res = await saveResult(analyst, allocId, validInput());
    expect(res.ok).toBe(true);
    const a = await getAllocationForTesting(admin, allocId);
    expect(a.result.status).toBe("IN_PROGRESS");
  });

  it("validates required fields", async () => {
    const allocId = await assignedTestAllocationId();
    await expect(saveResult(analyst, allocId, validInput({ resultValue: "" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("validates numeric results when a unit is specified", async () => {
    const allocId = await assignedTestAllocationId();
    await expect(saveResult(analyst, allocId, validInput({ resultValue: "not-a-number", unit: "CFU/g" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("allows a non-numeric result when no unit is specified (qualitative test)", async () => {
    const allocId = await assignedTestAllocationId();
    const res = await saveResult(analyst, allocId, validInput({ resultValue: "Pass", unit: undefined }));
    expect(res.ok).toBe(true);
  });

  it("rejects a future test date", async () => {
    const allocId = await assignedTestAllocationId();
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await expect(saveResult(analyst, allocId, validInput({ testDate: future }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects entry from an analyst the test isn't assigned to", async () => {
    const allocId = await assignedTestAllocationId(); // assigned to user_4 (ANALYST)
    await expect(saveResult(otherAnalyst, allocId, validInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires the result belongs to a worksheet before entry", async () => {
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
    // never placed on a worksheet
    await expect(saveResult(analyst, alloc.id, validInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("completion and correction", () => {
  it("completes a result and blocks further plain edits", async () => {
    const allocId = await assignedTestAllocationId();
    await saveResult(analyst, allocId, validInput());
    await completeResult(analyst, allocId);
    const a = await getAllocationForTesting(admin, allocId);
    expect(a.result.status).toBe("COMPLETED");
    await expect(saveResult(analyst, allocId, validInput({ resultValue: "99" }))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("blocks completion before a result exists", async () => {
    const allocId = await assignedTestAllocationId();
    await expect(completeResult(analyst, allocId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows a correction to a completed result only with a reason, and audits it", async () => {
    const allocId = await assignedTestAllocationId();
    await saveResult(analyst, allocId, validInput());
    await completeResult(analyst, allocId);
    await expect(correctResult(manager, allocId, validInput({ resultValue: "99" }), "")).rejects.toMatchObject({ code: "VALIDATION" });
    const res = await correctResult(manager, allocId, validInput({ resultValue: "99" }), "Transcription error on original entry");
    expect(res.ok).toBe(true);
    const a = await getAllocationForTesting(admin, allocId);
    expect(a.result.resultValue).toBe("99");
  });

  it("denies ANALYST/MICRO from correcting completed results (Admin/Manager only)", async () => {
    const allocId = await assignedTestAllocationId();
    await saveResult(analyst, allocId, validInput());
    await completeResult(analyst, allocId);
    await expect(correctResult(analyst, allocId, validInput({ resultValue: "99" }), "reason")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("RBAC", () => {
  it("denies CLIENT from any testing access", async () => {
    await expect(listTestingQueue(clientUser, {})).rejects.toBeInstanceOf(ResultEntryError);
  });

  it("scopes ANALYST/MICRO queue to only their own assigned tests", async () => {
    const allocId = await assignedTestAllocationId(); // user_4
    const ownList = await listTestingQueue(analyst, {});
    expect(ownList.rows.some((r) => r.testAllocationId === allocId)).toBe(true);
    const otherList = await listTestingQueue(otherAnalyst, {});
    expect(otherList.rows.some((r) => r.testAllocationId === allocId)).toBe(false);
  });

  it("allows QA to view all but not enter results", async () => {
    const allocId = await assignedTestAllocationId();
    await expect(saveResult(qa, allocId, validInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listTestingQueue(qa, {});
    expect(list.rows.some((r) => r.testAllocationId === allocId)).toBe(true);
  });
});

describe("audit", () => {
  it("records RESULT_CREATED and TEST_COMPLETED", async () => {
    const allocId = await assignedTestAllocationId();
    const created = await saveResult(analyst, allocId, validInput());
    await completeResult(analyst, allocId);
    const history = await prisma.auditLog.findMany({ where: { module: "testing", entityId: created.id } });
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["RESULT_CREATED", "TEST_COMPLETED"]));
  });
});
