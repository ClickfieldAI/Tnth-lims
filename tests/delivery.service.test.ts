import { describe, it, expect } from "vitest";
import { createDelivery, markDeliveryFailed, retryDelivery, listDeliveryQueue, listReleasedReportsForCustomer, getDeliveriesForReport } from "@/lib/delivery/service";
import { DeliveryError, type Actor } from "@/lib/delivery/access";
import { releaseReport } from "@/lib/release/service";
import { approveReport } from "@/lib/qa-review/service";
import { createDraftReport, generateDraftReport, submitDraftReportForQa } from "@/lib/reports/service";
import { verifyResult } from "@/lib/verification/service";
import { saveResult, completeResult } from "@/lib/result-entry/service";
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
const clientUser1: Actor = { id: "user_6", role: "CLIENT", clientId: "client_1" };

async function activeCustomerId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma.client.findFirst({ where: { isActive: true, id: "client_1" } }) as any);
  return c.id as string;
}

const fullAssessment = {
  labelingSatisfactory: "Satisfactory", quantitySufficient: "Satisfactory", packagingSatisfactory: "Satisfactory",
  sampleConditionSatisfactory: "Satisfactory", testRequestComplete: "Satisfactory",
} as const;

async function releasedReport() {
  const customerId = await activeCustomerId(); // client_1 — matches clientUser1
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
  const reg = await registerSample(admin, sample.id!, emptyRegisterSampleInput());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = await prisma.trfSample.findUnique({ where: { id: sample.id! }, include: { tests: true } }) as any;
  const alloc = await allocateTest(admin, s.tests[0].id, { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
  const ws = await createWorksheet(admin, { testAllocationIds: [alloc.id] });
  await prepareWorksheet(admin, ws.id);
  await assignWorksheet(admin, ws.id);
  const result = await saveResult(analyst, alloc.id, { ...emptyResultEntryInput(), resultValue: "45", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10) });
  await completeResult(analyst, alloc.id);
  await verifyResult(qa, result.id);

  const rep = await createDraftReport(admin, { sampleRegistrationId: reg.id, testResultIds: [result.id] });
  await generateDraftReport(admin, rep.id);
  await submitDraftReportForQa(admin, rep.id);
  await approveReport(qa, rep.id);
  await releaseReport(admin, rep.id);
  return { reportId: rep.id, customerId };
}

describe("released-report requirement", () => {
  it("rejects delivering a report that has not been released", async () => {
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
    const reg = await registerSample(admin, sample.id!, emptyRegisterSampleInput());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await prisma.trfSample.findUnique({ where: { id: sample.id! }, include: { tests: true } }) as any;
    const alloc = await allocateTest(admin, s.tests[0].id, { ...emptyAllocateTestInput(), analystId: "user_4", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
    const ws = await createWorksheet(admin, { testAllocationIds: [alloc.id] });
    await prepareWorksheet(admin, ws.id);
    await assignWorksheet(admin, ws.id);
    const result = await saveResult(analyst, alloc.id, { ...emptyResultEntryInput(), resultValue: "45", unit: "CFU/g", testDate: new Date().toISOString().slice(0, 10) });
    await completeResult(analyst, alloc.id);
    await verifyResult(qa, result.id);
    const rep = await createDraftReport(admin, { sampleRegistrationId: reg.id, testResultIds: [result.id] });
    await generateDraftReport(admin, rep.id); // never released
    await expect(createDelivery(admin, rep.id, { deliveryMethod: "EMAIL", recipient: "customer@example.com" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("delivery", () => {
  it("delivers a released report", async () => {
    const { reportId } = await releasedReport();
    const res = await createDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "quality@customer.example" });
    expect(res.ok).toBe(true);
  });
});

describe("duplicate prevention", () => {
  it("prevents a second active delivery, but allows retry after a failure", async () => {
    const { reportId } = await releasedReport();
    const first = await createDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" });
    await expect(createDelivery(admin, reportId, { deliveryMethod: "PORTAL", recipient: "a@example.com" })).rejects.toMatchObject({ code: "CONFLICT" });

    await markDeliveryFailed(admin, first.id, "Recipient mailbox full");
    // Once the only delivery has failed, it's no longer "active", so the
    // explicit retry path is available again (this is what "unless
    // explicitly retried" permits).
    const retried = await retryDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" });
    expect(retried.ok).toBe(true);
    // And now that the retry succeeded (DELIVERED), it's active again.
    await expect(createDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects retrying when the latest attempt was not a failure", async () => {
    const { reportId } = await releasedReport();
    await createDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" });
    await expect(retryDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("client visibility", () => {
  it("exposes only released reports belonging to that customer", async () => {
    const { reportId, customerId } = await releasedReport();
    const releasedForClient = await listReleasedReportsForCustomer(customerId);
    expect(releasedForClient.some((r) => r.id === reportId)).toBe(true);
  });

  it("denies a client from viewing another customer's delivery record", async () => {
    const { reportId } = await releasedReport(); // belongs to client_1
    const otherClient: Actor = { id: "user_x", role: "CLIENT", clientId: "client_2" };
    await expect(getDeliveriesForReport(otherClient, reportId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows the owning client to view their own delivered report", async () => {
    const { reportId } = await releasedReport();
    await createDelivery(admin, reportId, { deliveryMethod: "PORTAL", recipient: "portal-user" });
    const r = await getDeliveriesForReport(clientUser1, reportId);
    expect(r.id).toBe(reportId);
  });
});

describe("RBAC", () => {
  it("denies ANALYST from managing delivery, but allows viewing", async () => {
    const { reportId } = await releasedReport();
    await expect(createDelivery(analyst, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listDeliveryQueue(analyst, {});
    expect(list.rows).toBeDefined();
  });
});

describe("audit", () => {
  it("records REPORT_DELIVERED", async () => {
    const { reportId } = await releasedReport();
    const res = await createDelivery(admin, reportId, { deliveryMethod: "EMAIL", recipient: "a@example.com" });
    const history = await prisma.auditLog.findMany({ where: { module: "report-delivery", entityId: res.id } });
    expect(history.some((h) => h.action === "REPORT_DELIVERED")).toBe(true);
  });
});
