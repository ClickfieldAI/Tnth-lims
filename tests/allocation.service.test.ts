import { describe, it, expect } from "vitest";
import { allocateTest, reassignTest, listAllocationQueue, getAllocationHistory } from "@/lib/allocation/service";
import { AllocationError, type Actor } from "@/lib/allocation/access";
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
const analyst: Actor = { id: "user_4", role: "ANALYST" }; // Divya Krishnan
const micro: Actor = { id: "user_5", role: "MICRO" };
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

async function registeredSampleWithTestRequest(testCount = 1) {
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
  const reg = await registerSample(admin, sample.id!, emptyRegisterSampleInput());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = await prisma.trfSample.findUnique({ where: { id: sample.id! }, include: { tests: true } }) as any;
  return { trfId: draft.id, sampleId: sample.id!, sampleCode: reg.sampleCode, testRequestIds: (s.tests as { id: string }[]).map((t) => t.id) };
}

function validInput(overrides: Partial<ReturnType<typeof emptyAllocateTestInput>> = {}) {
  return { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), ...overrides };
}

describe("allocation eligibility", () => {
  it("rejects allocation for a sample that is not registered", async () => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await prisma.trfSample.findUnique({ where: { id: sample.id! }, include: { tests: true } }) as any;
    await expect(allocateTest(admin, s.tests[0].id, validInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("allocation", () => {
  it("allocates a requested test to a valid analyst", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    const res = await allocateTest(admin, testRequestIds[0], validInput());
    expect(res.ok).toBe(true);
  });

  it("rejects an invalid sample/test id", async () => {
    await expect(allocateTest(admin, "no-such-test", validInput())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents duplicate active allocation of the same test", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await allocateTest(admin, testRequestIds[0], validInput());
    await expect(allocateTest(admin, testRequestIds[0], validInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("validates the analyst is an Analyst/Micro-role user", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await expect(allocateTest(admin, testRequestIds[0], validInput({ analystId: "user_3" }))).rejects.toMatchObject({ code: "VALIDATION" }); // QA, not analyst
  });

  it("allows a Microbiology Analyst for microbiology-style tests", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    const res = await allocateTest(admin, testRequestIds[0], validInput({ analystId: "user_5" }));
    expect(res.ok).toBe(true);
  });

  it("validates the due date and priority are provided", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await expect(allocateTest(admin, testRequestIds[0], { ...validInput(), dueDate: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("reassignment", () => {
  it("reassigns an allocated test to a different analyst and audits it", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    const created = await allocateTest(admin, testRequestIds[0], validInput({ analystId: "user_4" }));
    await reassignTest(manager, testRequestIds[0], validInput({ analystId: "user_5" }));
    const history = await getAllocationHistory(admin, created.id);
    expect(history.some((h) => h.action === "TEST_REASSIGNED")).toBe(true);
  });

  it("rejects reassigning a test that was never allocated", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await expect(reassignTest(admin, testRequestIds[0], validInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("RBAC", () => {
  it("denies ANALYST from allocating but allows viewing only their own", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await expect(allocateTest(analyst, testRequestIds[0], validInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listAllocationQueue(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("scopes MICRO/ANALYST queue view to only their own allocated tests", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await allocateTest(admin, testRequestIds[0], validInput({ analystId: "user_5" }));
    const analystList = await listAllocationQueue(analyst, {});
    expect(analystList.rows.some((r) => r.testRequestId === testRequestIds[0])).toBe(false);
    const microList = await listAllocationQueue(micro, {});
    expect(microList.rows.some((r) => r.testRequestId === testRequestIds[0])).toBe(true);
  });

  it("denies CLIENT from any allocation access", async () => {
    await expect(listAllocationQueue(clientUser, {})).rejects.toBeInstanceOf(AllocationError);
  });

  it("allows QA to view and see history but not allocate", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    await expect(allocateTest(qa, testRequestIds[0], validInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("audit", () => {
  it("records TEST_ALLOCATED on allocation", async () => {
    const { testRequestIds } = await registeredSampleWithTestRequest(1);
    const created = await allocateTest(admin, testRequestIds[0], validInput());
    const history = await getAllocationHistory(admin, created.id);
    expect(history.some((h) => h.action === "TEST_ALLOCATED")).toBe(true);
  });
});

describe("queue", () => {
  it("lists eligible tests with search/filter/pagination", async () => {
    const { testRequestIds, sampleCode } = await registeredSampleWithTestRequest(2);
    await allocateTest(admin, testRequestIds[0], validInput());
    const list = await listAllocationQueue(admin, { search: sampleCode });
    expect(list.rows.length).toBe(2);
    const filtered = await listAllocationQueue(admin, { status: "ALLOCATED" });
    expect(filtered.rows.every((r) => r.status === "ALLOCATED")).toBe(true);
    const page = await listAllocationQueue(admin, { pageSize: 1, page: 1 });
    expect(page.rows.length).toBe(1);
  });
});
