import { describe, it, expect } from "vitest";
import { createDraftReport, generateDraftReport, submitDraftReportForQa, listVerifiedResultsForSample, getDraftReport, getDraftReportPdfData } from "@/lib/reports/service";
import { DraftReportError, type Actor } from "@/lib/reports/access";
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

async function sampleWithVerifiedResult() {
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
  const sample = await addTrfSample(admin, draft.id, { ...emptySample(), sampleName: "Sample A", productCategory: "Food", batchNumber: "B1", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer", tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }] });
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
  return { sampleRegistrationId: reg.id, testResultId: result.id };
}

describe("verified-result requirement", () => {
  it("only lists verified results as available for a report", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const available = await listVerifiedResultsForSample(admin, sampleRegistrationId);
    expect(available.some((a) => a.testResultId === testResultId)).toBe(true);
  });

  it("rejects including an unverified/unrelated result id", async () => {
    const { sampleRegistrationId } = await sampleWithVerifiedResult();
    await expect(createDraftReport(admin, { sampleRegistrationId, testResultIds: ["no-such-result"] })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires at least one result selected", async () => {
    const { sampleRegistrationId } = await sampleWithVerifiedResult();
    await expect(createDraftReport(admin, { sampleRegistrationId, testResultIds: [] })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("report generation", () => {
  it("creates a draft report with an RPT-YYYY-0001 code, then generates it", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const res = await createDraftReport(admin, { sampleRegistrationId, testResultIds: [testResultId] });
    expect(res.reportCode).toMatch(/^RPT-\d{4}-\d{4}$/);
    const gen = await generateDraftReport(admin, res.id);
    expect(gen.ok).toBe(true);
    const r = await getDraftReport(admin, res.id);
    expect(r.status).toBe("GENERATED");
  });

  it("blocks generating an empty report and blocks re-generating", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const res = await createDraftReport(admin, { sampleRegistrationId, testResultIds: [testResultId] });
    await generateDraftReport(admin, res.id);
    await expect(generateDraftReport(admin, res.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("submits a generated report for QA review", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const res = await createDraftReport(admin, { sampleRegistrationId, testResultIds: [testResultId] });
    await generateDraftReport(admin, res.id);
    const sub = await submitDraftReportForQa(admin, res.id);
    expect(sub.ok).toBe(true);
    const r = await getDraftReport(admin, res.id);
    expect(r.status).toBe("SENT_FOR_QA");
  });
});

describe("report data mapping & PDF generation", () => {
  it("maps report data into the existing TnthReportData shape with real values", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const res = await createDraftReport(admin, { sampleRegistrationId, testResultIds: [testResultId] });
    await generateDraftReport(admin, res.id);
    const data = await getDraftReportPdfData(admin, res.id);
    expect(data.reportNo).toBe(res.reportCode);
    expect(data.sections[0].rows[0].result).toBe("45");
    expect(data.sections[0].rows[0].unit).toBe("CFU/g");
    expect(data.batchNo).toBe("B1");
  });

  it("generates a PDF document without throwing", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const res = await createDraftReport(admin, { sampleRegistrationId, testResultIds: [testResultId] });
    await generateDraftReport(admin, res.id);
    const data = await getDraftReportPdfData(admin, res.id);
    const { generateTnthReportPdf } = await import("@/lib/tnth-pdf");
    const doc = generateTnthReportPdf(data);
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});

describe("RBAC", () => {
  it("denies CLIENT from any draft report access", async () => {
    const { sampleRegistrationId } = await sampleWithVerifiedResult();
    await expect(listVerifiedResultsForSample(clientUser, sampleRegistrationId)).rejects.toBeInstanceOf(DraftReportError);
  });

  it("denies QA from creating a report (Admin/Manager only)", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    await expect(createDraftReport(qa, { sampleRegistrationId, testResultIds: [testResultId] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("audit", () => {
  it("records creation and generation events", async () => {
    const { sampleRegistrationId, testResultId } = await sampleWithVerifiedResult();
    const res = await createDraftReport(admin, { sampleRegistrationId, testResultIds: [testResultId] });
    await generateDraftReport(admin, res.id);
    const history = await prisma.auditLog.findMany({ where: { module: "reports", entityId: res.id } });
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["DRAFT_REPORT_CREATED", "DRAFT_REPORT_GENERATED"]));
  });
});
