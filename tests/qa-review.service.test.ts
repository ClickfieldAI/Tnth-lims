import { describe, it, expect } from "vitest";
import { approveReport, returnReport, listQaReviewQueue, getReportForQaReview, isApprovalLocked } from "@/lib/qa-review/service";
import { QaReviewError, type Actor } from "@/lib/qa-review/access";
import { createDraftReport, generateDraftReport, submitDraftReportForQa, createReportRevision, getDraftReport } from "@/lib/reports/service";
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

async function reportSentForQa() {
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
  await verifyResult(qa, result.id, "Within limits");

  const rep = await createDraftReport(admin, { sampleRegistrationId: reg.id, testResultIds: [result.id] });
  await generateDraftReport(admin, rep.id);
  await submitDraftReportForQa(admin, rep.id);
  return rep.id;
}

describe("QA approval", () => {
  it("approves a report sent for QA review", async () => {
    const reportId = await reportSentForQa();
    const res = await approveReport(qa, reportId, "Looks good, approved for release.");
    expect(res.ok).toBe(true);
    const r = await getReportForQaReview(admin, reportId);
    expect(r.qaReview.status).toBe("APPROVED");
    expect(await isApprovalLocked(reportId)).toBe(true);
  });

  it("rejects approving a report not in SENT_FOR_QA (e.g. still DRAFT)", async () => {
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
    const rep = await createDraftReport(admin, { sampleRegistrationId: reg.id, testResultIds: [result.id] }); // still DRAFT
    await expect(approveReport(qa, rep.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("QA return", () => {
  it("requires a reason and unlocks the report back to DRAFT", async () => {
    const reportId = await reportSentForQa();
    await expect(returnReport(qa, reportId, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await returnReport(qa, reportId, "Method name is missing on line 1 — please correct.");
    const r = await getDraftReport(admin, reportId);
    expect(r.status).toBe("DRAFT");
    const review = await getReportForQaReview(admin, reportId);
    expect(review.qaReview.status).toBe("RETURNED");
  });
});

describe("revision/edit restrictions after approval", () => {
  it("blocks re-approving an already-approved report and requires a new revision for further changes", async () => {
    const reportId = await reportSentForQa();
    await approveReport(qa, reportId);
    await expect(approveReport(qa, reportId)).rejects.toMatchObject({ code: "CONFLICT" });

    const rev = await createReportRevision(admin, reportId, "Customer requested a formatting correction");
    expect(rev.id).not.toBe(reportId);
    const revReport = await getDraftReport(admin, rev.id);
    expect(revReport.status).toBe("DRAFT");
    expect(revReport.revisionNumber).toBe(2);
    expect(revReport.previousVersionId).toBe(reportId);

    // The original approved report is untouched.
    const original = await getDraftReport(admin, reportId);
    expect(original.status).toBe("SENT_FOR_QA");
  });
});

describe("RBAC", () => {
  it("denies CLIENT from any QA review access", async () => {
    await expect(listQaReviewQueue(clientUser, {})).rejects.toBeInstanceOf(QaReviewError);
  });

  it("allows ANALYST to view but not decide", async () => {
    const reportId = await reportSentForQa();
    await expect(approveReport(analyst, reportId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listQaReviewQueue(analyst, {});
    expect(list.rows.some((r) => r.id === reportId)).toBe(true);
  });

  it("allows Admin/Manager to decide in addition to QA", async () => {
    const reportId = await reportSentForQa();
    const res = await approveReport(manager, reportId);
    expect(res.ok).toBe(true);
  });
});

describe("audit", () => {
  it("records QA_REPORT_APPROVED and QA_REPORT_RETURNED", async () => {
    const reportId = await reportSentForQa();
    await approveReport(qa, reportId, "ok");
    const history = await prisma.auditLog.findMany({ where: { module: "qa-review", entityId: reportId } });
    expect(history.some((h) => h.action === "QA_REPORT_APPROVED")).toBe(true);
  });
});
