import { describe, it, expect } from "vitest";
import { extendRetention, disposeSample, listRetentionQueue, getRetentionRecord } from "@/lib/retention/service";
import { RetentionError, type Actor } from "@/lib/retention/access";
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

async function retainedSampleId() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retention = await prisma.retentionRecord.findFirst({ where: { sampleRegistrationId: reg.id } }) as any;
  return retention.id as string;
}

describe("retention", () => {
  it("puts a released sample into retention with RETAINED status", async () => {
    const id = await retainedSampleId();
    const r = await getRetentionRecord(admin, id);
    expect(r.status).toBe("RETAINED");
    expect(r.retentionExpiryDate).toBeTruthy();
  });

  it("lists retained samples in the queue", async () => {
    const id = await retainedSampleId();
    const list = await listRetentionQueue(admin, {});
    expect(list.rows.some((r) => r.id === id)).toBe(true);
  });
});

describe("extension", () => {
  it("extends retention to a later date and marks it EXTENDED", async () => {
    const id = await retainedSampleId();
    const r = await getRetentionRecord(admin, id);
    const later = new Date(r.retentionExpiryDate.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const res = await extendRetention(admin, id, later, "Customer requested extended hold");
    expect(res.ok).toBe(true);
    const updated = await getRetentionRecord(admin, id);
    expect(updated.status).toBe("EXTENDED");
  });

  it("rejects extending to an earlier or equal date", async () => {
    const id = await retainedSampleId();
    const r = await getRetentionRecord(admin, id);
    const earlier = new Date(r.retentionExpiryDate.getTime() - 10 * 86400000).toISOString().slice(0, 10);
    await expect(extendRetention(admin, id, earlier)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("disposal", () => {
  it("requires a disposal reason", async () => {
    const id = await retainedSampleId();
    await expect(disposeSample(admin, id, "")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("records who performed disposal and marks DISPOSED without deleting the record", async () => {
    const id = await retainedSampleId();
    await disposeSample(manager, id, "Retention period expired, routine disposal");
    const r = await getRetentionRecord(admin, id);
    expect(r.status).toBe("DISPOSED");
    expect(r.disposedById).toBe("user_2");
    expect(r.disposalDate).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stillExists = await prisma.retentionRecord.findUnique({ where: { id } }) as any;
    expect(stillExists).toBeTruthy(); // never physically deleted
  });

  it("rejects disposing an already-disposed record", async () => {
    const id = await retainedSampleId();
    await disposeSample(admin, id, "reason");
    await expect(disposeSample(admin, id, "reason again")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("RBAC", () => {
  it("denies CLIENT from any retention access", async () => {
    await expect(listRetentionQueue(clientUser, {})).rejects.toBeInstanceOf(RetentionError);
  });

  it("denies ANALYST from extending or disposing, but allows viewing", async () => {
    const id = await retainedSampleId();
    await expect(extendRetention(analyst, id, "2099-01-01")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(disposeSample(analyst, id, "reason")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listRetentionQueue(analyst, {});
    expect(list.rows.some((r) => r.id === id)).toBe(true);
  });

  it("allows QA to extend but not dispose", async () => {
    const id = await retainedSampleId();
    const res = await extendRetention(qa, id, "2099-01-01");
    expect(res.ok).toBe(true);
    await expect(disposeSample(qa, id, "reason")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("audit", () => {
  it("records RETENTION_STARTED, RETENTION_EXTENDED and SAMPLE_DISPOSED", async () => {
    const id = await retainedSampleId();
    await extendRetention(admin, id, "2099-01-01");
    await disposeSample(admin, id, "reason");
    const history = await prisma.auditLog.findMany({ where: { module: "retention", entityId: id } });
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["RETENTION_STARTED", "RETENTION_EXTENDED", "SAMPLE_DISPOSED"]));
  });
});
