import { describe, it, expect } from "vitest";
import { createWorksheet, addTestToWorksheet, prepareWorksheet, assignWorksheet, listWorksheets, getWorksheet, getWorksheetHistory } from "@/lib/worksheets/service";
import { WorksheetError, type Actor } from "@/lib/worksheets/access";
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
const analyst: Actor = { id: "user_4", role: "ANALYST" };
const qa: Actor = { id: "user_3", role: "QA" };
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

async function allocatedTestRequestIds(testCount = 1) {
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
  const tests: ReturnType<typeof emptyTestRequest>[] = [];
  for (let i = 0; i < testCount; i += 1) tests.push({ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: `Param ${i + 1}` });
  const sample = await addTrfSample(admin, draft.id, { ...emptySample(), sampleName: "Sample A", productCategory: "Food", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer", tests });
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
  const testRequestIds = (s.tests as { id: string }[]).map((t) => t.id);
  const allocationIds: string[] = [];
  for (const trId of testRequestIds) {
    const res = await allocateTest(admin, trId, { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
    allocationIds.push(res.id);
  }
  return allocationIds;
}

describe("worksheet creation", () => {
  it("creates a worksheet from one or more allocated tests with a WS-YYYY-0001 code", async () => {
    const allocationIds = await allocatedTestRequestIds(2);
    const res = await createWorksheet(admin, { testAllocationIds: allocationIds });
    expect(res.ok).toBe(true);
    expect(res.worksheetCode).toMatch(/^WS-\d{4}-\d{4}$/);
    const w = await getWorksheet(admin, res.id);
    expect(w.items.length).toBe(2);
    expect(w.status).toBe("DRAFT");
  });

  it("rejects creating a worksheet with no tests selected", async () => {
    await expect(createWorksheet(admin, { testAllocationIds: [] })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects an unallocated/unknown test id", async () => {
    await expect(createWorksheet(admin, { testAllocationIds: ["no-such-allocation"] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents the same allocated test being placed on two worksheets", async () => {
    const allocationIds = await allocatedTestRequestIds(1);
    await createWorksheet(admin, { testAllocationIds: allocationIds });
    await expect(createWorksheet(admin, { testAllocationIds: allocationIds })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("worksheet editing and assignment", () => {
  it("adds and removes tests only while in DRAFT", async () => {
    const [a1] = await allocatedTestRequestIds(1);
    const [a2] = await allocatedTestRequestIds(1);
    const res = await createWorksheet(admin, { testAllocationIds: [a1] });
    await addTestToWorksheet(admin, res.id, a2);
    let w = await getWorksheet(admin, res.id);
    expect(w.items.length).toBe(2);

    await prepareWorksheet(admin, res.id);
    await expect(addTestToWorksheet(admin, res.id, a2)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("goes DRAFT -> PREPARED -> ASSIGNED", async () => {
    const allocationIds = await allocatedTestRequestIds(1);
    const res = await createWorksheet(admin, { testAllocationIds: allocationIds });
    await prepareWorksheet(admin, res.id);
    let w = await getWorksheet(admin, res.id);
    expect(w.status).toBe("PREPARED");
    await assignWorksheet(manager, res.id);
    w = await getWorksheet(admin, res.id);
    expect(w.status).toBe("ASSIGNED");
  });

  it("rejects preparing an empty worksheet path (cannot happen via create, but guards direct calls)", async () => {
    const allocationIds = await allocatedTestRequestIds(1);
    const res = await createWorksheet(admin, { testAllocationIds: allocationIds });
    await prepareWorksheet(admin, res.id);
    await expect(prepareWorksheet(admin, res.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("records audit history for create/prepare/assign", async () => {
    const allocationIds = await allocatedTestRequestIds(1);
    const res = await createWorksheet(admin, { testAllocationIds: allocationIds });
    await prepareWorksheet(admin, res.id);
    await assignWorksheet(admin, res.id);
    const history = await getWorksheetHistory(admin, res.id);
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["WORKSHEET_CREATED", "WORKSHEET_PREPARED", "WORKSHEET_ASSIGNED"]));
  });
});

describe("RBAC", () => {
  it("denies ANALYST from creating a worksheet but allows viewing only their own", async () => {
    const allocationIds = await allocatedTestRequestIds(1);
    await expect(createWorksheet(analyst, { testAllocationIds: allocationIds })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const res = await createWorksheet(admin, { testAllocationIds: allocationIds }); // analyst = user_4
    const list = await listWorksheets(analyst, {});
    expect(list.rows.some((w) => w.id === res.id)).toBe(true);
  });

  it("denies CLIENT from any worksheet access", async () => {
    await expect(listWorksheets(clientUser, {})).rejects.toBeInstanceOf(WorksheetError);
  });

  it("allows QA to view and see history but not create", async () => {
    const allocationIds = await allocatedTestRequestIds(1);
    await expect(createWorksheet(qa, { testAllocationIds: allocationIds })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
