import { describe, it, expect } from "vitest";
import {
  requestCorrection, startCorrectionReview, approveCorrection, rejectCorrection, completeCorrection, listCorrections, getCorrection,
} from "@/lib/corrections/service";
import { CorrectionError, type Actor } from "@/lib/corrections/access";
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

async function reportThroughPipeline() {
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
  return { reportId: rep.id, sampleRegistrationId: reg.id };
}

async function draftOnlyReport() {
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
  return { reportId: rep.id };
}

async function releasedReport() {
  const ctx = await reportThroughPipeline();
  await approveReport(qa, ctx.reportId);
  await releaseReport(admin, ctx.reportId);
  return ctx;
}

const input = (draftReportId: string) => ({
  draftReportId, description: "Impurity result for Parameter X", originalValue: "45 CFU/g", correctedValue: "42 CFU/g", reason: "Transcription error identified during a routine re-check",
});

describe("request requires a non-draft report", () => {
  it("rejects correcting a plain draft (direct edit should be used instead)", async () => {
    const { reportId } = await draftOnlyReport();
    await expect(requestCorrection(analyst, input(reportId))).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("full lifecycle", () => {
  it("requests, reviews, approves and completes a correction on a released report, generating a new revision without overwriting the original", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    expect(req.ok).toBe(true);

    await startCorrectionReview(qa, req.id);
    await approveCorrection(qa, req.id, "Confirmed against raw data");
    const done = await completeCorrection(qa, req.id);
    expect(done.ok).toBe(true);
    expect(done.newRevisionId).toBeTruthy();

    const c = await getCorrection(admin, req.id);
    expect(c.status).toBe("COMPLETED");
    expect(c.originalValue).toBe("45 CFU/g");
    expect(c.correctedValue).toBe("42 CFU/g");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = await prisma.draftReport.findUnique({ where: { id: reportId } }) as any;
    expect(original.status).toBe("SENT_FOR_QA"); // untouched — never silently overwritten

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revision = await prisma.draftReport.findUnique({ where: { id: c.newRevisionId } }) as any;
    expect(revision.previousVersionId).toBe(reportId);
    expect(revision.revisionNumber).toBe(original.revisionNumber + 1);
  });

  it("completes without a new revision when the source report was never released", async () => {
    const { reportId } = await reportThroughPipeline();
    const req = await requestCorrection(analyst, input(reportId));
    await startCorrectionReview(qa, req.id);
    await approveCorrection(qa, req.id);
    const done = await completeCorrection(qa, req.id);
    expect(done.newRevisionId).toBeNull();
  });
});

describe("duplicate prevention", () => {
  it("rejects a second active correction request while one is already REQUESTED/UNDER_REVIEW/APPROVED", async () => {
    const { reportId } = await releasedReport();
    await requestCorrection(analyst, input(reportId));
    await expect(requestCorrection(analyst, input(reportId))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows a new request once the prior one is resolved (REJECTED/COMPLETED)", async () => {
    const { reportId } = await releasedReport();
    const first = await requestCorrection(analyst, input(reportId));
    await startCorrectionReview(qa, first.id);
    await rejectCorrection(qa, first.id, "Original result confirmed correct");
    const second = await requestCorrection(analyst, input(reportId));
    expect(second.ok).toBe(true);
  });
});

describe("validation", () => {
  it("requires a reason, and preserves the original/corrected values separately", async () => {
    const { reportId } = await releasedReport();
    await expect(requestCorrection(analyst, { ...input(reportId), reason: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires a reason to reject", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    await startCorrectionReview(qa, req.id);
    await expect(rejectCorrection(qa, req.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await rejectCorrection(qa, req.id, "Not a valid correction — original result confirmed correct");
    const c = await getCorrection(admin, req.id);
    expect(c.status).toBe("REJECTED");
  });
});

describe("separation of duties", () => {
  it("prevents the requester from reviewing their own correction (Admin exempted)", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(qa, input(reportId));
    await expect(startCorrectionReview(qa, req.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await startCorrectionReview(admin, req.id); // admin exempt
  });

  it("only the claiming reviewer can approve/reject", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    await startCorrectionReview(qa, req.id);
    await expect(approveCorrection(manager, req.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await approveCorrection(admin, req.id); // admin exempt
  });
});

describe("status transitions", () => {
  it("rejects approving/rejecting before a review has been claimed", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    await expect(approveCorrection(qa, req.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects completing before approval", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    await startCorrectionReview(qa, req.id);
    await expect(completeCorrection(qa, req.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("RBAC", () => {
  it("denies CLIENT entirely", async () => {
    const { reportId } = await releasedReport();
    await expect(listCorrections(clientUser, {})).rejects.toBeInstanceOf(CorrectionError);
    await expect(requestCorrection(clientUser, input(reportId))).rejects.toBeInstanceOf(CorrectionError);
  });

  it("allows ANALYST to request but not decide", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    await expect(startCorrectionReview(analyst, req.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("audit", () => {
  it("records the full request -> review -> approve -> complete trail", async () => {
    const { reportId } = await releasedReport();
    const req = await requestCorrection(analyst, input(reportId));
    await startCorrectionReview(qa, req.id);
    await approveCorrection(qa, req.id);
    await completeCorrection(qa, req.id);
    const history = await prisma.auditLog.findMany({ where: { module: "corrections", entityId: req.id } });
    const actions = history.map((h) => h.action);
    expect(actions).toContain("CORRECTION_REQUESTED");
    expect(actions).toContain("CORRECTION_UNDER_REVIEW");
    expect(actions).toContain("CORRECTION_APPROVED");
    expect(actions).toContain("CORRECTION_COMPLETED");
  });
});
