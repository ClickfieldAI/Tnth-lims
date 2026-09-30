import { describe, it, expect } from "vitest";
import { releaseReport, returnReportFromRelease, listReleaseQueue, getReportForRelease, isReleaseLocked } from "@/lib/release/service";
import { ReleaseError, type Actor } from "@/lib/release/access";
import { approveReport } from "@/lib/qa-review/service";
import { createDraftReport, generateDraftReport, submitDraftReportForQa, getDraftReport } from "@/lib/reports/service";
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

async function reportPendingRelease() {
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

describe("release requires QA approval", () => {
  it("rejects releasing a report not yet QA-approved", async () => {
    const { reportId } = await reportPendingRelease();
    await expect(releaseReport(admin, reportId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("releases a QA-approved report, recording release date and authorized person", async () => {
    const { reportId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    const res = await releaseReport(manager, reportId, "Final check complete");
    expect(res.ok).toBe(true);
    const r = await getReportForRelease(admin, reportId);
    expect(r.release.status).toBe("RELEASED");
    expect(r.release.releasedById).toBe("user_2");
    expect(r.release.releasedAt).toBeTruthy();
  });
});

describe("locking", () => {
  it("locks a released report from a second release or a return", async () => {
    const { reportId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    await releaseReport(admin, reportId);
    expect(await isReleaseLocked(reportId)).toBe(true);
    await expect(releaseReport(admin, reportId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(returnReportFromRelease(admin, reportId, "reason")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cannot bypass the workflow — release requires the authorization step even for Admin", async () => {
    const { reportId } = await reportPendingRelease();
    await expect(releaseReport(admin, reportId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("return with reason", () => {
  it("requires a reason and unlocks the report back to DRAFT", async () => {
    const { reportId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    await expect(returnReportFromRelease(admin, reportId, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await returnReportFromRelease(admin, reportId, "Signatory block needs correction");
    const r = await getDraftReport(admin, reportId);
    expect(r.status).toBe("DRAFT");
  });
});

describe("RBAC", () => {
  it("denies CLIENT from the internal release queue", async () => {
    await expect(listReleaseQueue(clientUser, {})).rejects.toBeInstanceOf(ReleaseError);
  });

  it("denies QA from releasing (Admin/Manager only)", async () => {
    const { reportId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    await expect(releaseReport(qa, reportId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows ANALYST to view", async () => {
    const { reportId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    const list = await listReleaseQueue(analyst, {});
    expect(list.rows.some((r) => r.id === reportId)).toBe(true);
  });
});

describe("audit", () => {
  it("records REPORT_RELEASED", async () => {
    const { reportId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    await releaseReport(admin, reportId);
    const history = await prisma.auditLog.findMany({ where: { module: "report-release", entityId: reportId } });
    expect(history.some((h) => h.action === "REPORT_RELEASED")).toBe(true);
  });

  it("enters the sample into retention on release", async () => {
    const { reportId, sampleRegistrationId } = await reportPendingRelease();
    await approveReport(qa, reportId);
    await releaseReport(admin, reportId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retention = await prisma.retentionRecord.findFirst({ where: { sampleRegistrationId } }) as any;
    expect(retention).toBeTruthy();
    expect(retention.status).toBe("RETAINED");
  });
});
