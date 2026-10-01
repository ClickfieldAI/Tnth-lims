// Demo-readiness seeding — walks a handful of samples through the REAL
// service-layer pipeline (the same functions the UI and server actions
// call) so the demo has interconnected, valid data at every stage: a
// released+delivered report with a completed correction, a report awaiting
// QA, and a sample still mid-testing. Runs once per server process (see
// instrumentation.ts), guarded against re-running on hot reload.
//
// Deliberately NOT business logic — this only calls the existing, already
//-tested service functions in the same way tests/*.test.ts do, so nothing
// here can produce data the real workflow wouldn't also produce.
import { prisma } from "@/lib/prisma";
import { createEnquiry, createQuotation, updateQuotationDraft, submitQuotationForApproval, approveQuotation, sendQuotation, recordAcceptance } from "@/lib/enquiries/service";
import { emptyEnquiryInput, emptyProduct, emptyTestRequest as emptyEnqTest } from "@/lib/enquiries/validation";
import { createTrfDraft, addTrfSample, updateTrfDraft, setTrfAuthorization, submitTrf, startTrfReview, acceptTrf } from "@/lib/trfs/service";
import { emptySample, emptyTestRequest } from "@/lib/trfs/validation";
import { recordSampleReceipt, confirmTrfReceipt } from "@/lib/receipts/service";
import { emptySampleReceiptInput } from "@/lib/receipts/validation";
import { saveAssessment, acceptSampleReview } from "@/lib/reviews/service";
import { registerSample } from "@/lib/registration/service";
import { emptyRegisterSampleInput } from "@/lib/registration/validation";
import { allocateTest } from "@/lib/allocation/service";
import { emptyAllocateTestInput } from "@/lib/allocation/validation";
import { createWorksheet, prepareWorksheet, assignWorksheet } from "@/lib/worksheets/service";
import { saveResult, completeResult } from "@/lib/result-entry/service";
import { emptyResultEntryInput } from "@/lib/result-entry/validation";
import { verifyResult } from "@/lib/verification/service";
import { createDraftReport, generateDraftReport, submitDraftReportForQa } from "@/lib/reports/service";
import { approveReport } from "@/lib/qa-review/service";
import { releaseReport } from "@/lib/release/service";
import { createDelivery } from "@/lib/delivery/service";
import { requestCorrection, startCorrectionReview, approveCorrection, completeCorrection } from "@/lib/corrections/service";

type Actor = { id: string; role: string };

const fullAssessment = {
  labelingSatisfactory: "Satisfactory", quantitySufficient: "Satisfactory", packagingSatisfactory: "Satisfactory",
  sampleConditionSatisfactory: "Satisfactory", testRequestComplete: "Satisfactory",
} as const;

async function actorFor(email: string): Promise<Actor> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = await (prisma.user.findFirst({ where: { email }, include: { role: true } }) as any);
  if (!u) throw new Error(`demo seed: user ${email} not found`);
  return { id: u.id, role: u.role?.name ?? "" };
}

async function customerIdFor(name: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma.client.findFirst({ where: { name } }) as any);
  if (!c) throw new Error(`demo seed: customer ${name} not found`);
  return c.id as string;
}

async function enquiryToAcceptedQuotation(
  admin: Actor, manager: Actor, customerId: string,
  product: { name: string; category: string; tests: { serviceId: string; requestedTest: string }[] },
  unitPrice: number,
) {
  const enqInput = emptyEnquiryInput();
  enqInput.customerId = customerId; enqInput.assignedManagerId = manager.id;
  enqInput.products = [{ ...emptyProduct(), productName: product.name, productCategory: product.category, tests: product.tests.map((t) => ({ ...emptyEnqTest(), serviceId: t.serviceId, requestedTest: t.requestedTest, requestedQuantity: 1 })) }];
  const enq = await createEnquiry(admin, enqInput);
  const quo = await createQuotation(admin, enq.id);
  await updateQuotationDraft(admin, quo.id, {
    validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), discountTotal: 0,
    items: product.tests.map((t) => ({ productReference: product.name, serviceName: t.requestedTest, quantity: 1, unitPrice, discount: 0, taxCategory: "GST 18%" })),
  });
  await submitQuotationForApproval(admin, quo.id);
  await approveQuotation(manager, quo.id);
  await sendQuotation(admin, quo.id);
  await recordAcceptance(manager, quo.id, {});
  return quo.id;
}

async function trfWithSample(
  admin: Actor, manager: Actor, customerId: string, quotationId: string,
  sample: { sampleName: string; productCategory: string; serviceId: string; requestedParameter: string },
) {
  const draft = await createTrfDraft(admin, { customerId, quotationId });
  const s = await addTrfSample(admin, draft.id, {
    ...emptySample(), sampleName: sample.sampleName, productCategory: sample.productCategory,
    quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer",
    tests: [{ ...emptyTestRequest(), serviceId: sample.serviceId, requestedParameter: sample.requestedParameter }],
  });
  await updateTrfDraft(admin, draft.id, { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false });
  await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Demo Authorized Signatory", authorizationMethod: "Other" });
  await submitTrf(admin, draft.id);
  await startTrfReview(manager, draft.id);
  await acceptTrf(manager, draft.id);
  return { trfId: draft.id, sampleId: s.id! };
}

export async function seedDemoWorkflow() {
  const admin = await actorFor("admin@tnth.io");
  const manager = await actorFor("manager@tnth.io");
  const qa = await actorFor("qa@tnth.io");
  const analyst = await actorFor("analyst@tnth.io");
  const micro = await actorFor("micro@tnth.io");

  // ---------------------------------------------------------------------
  // Journey A — Sundar Pharma Formulations (CL-001, the same customer the
  // seeded demo CLIENT account is linked to — see seed-data.ts's
  // clientUserId assignment — so logging in as client@tnth.io actually
  // shows this journey's released report): full lifecycle through to a
  // completed correction on a released, delivered report.
  // ---------------------------------------------------------------------
  const glowId = await customerIdFor("Sundar Pharma Formulations");
  const quoA = await enquiryToAcceptedQuotation(admin, manager, glowId,
    { name: "Paracetamol Oral Suspension — Export Batch", category: "Pharmaceuticals", tests: [{ serviceId: "quality-analysis", requestedTest: "Physicochemical quality panel" }] }, 6500);
  const { trfId: trfA, sampleId: sampleA } = await trfWithSample(admin, manager, glowId, quoA,
    { sampleName: "Paracetamol Oral Suspension — Batch SP-204", productCategory: "Pharmaceuticals", serviceId: "quality-analysis", requestedParameter: "pH & viscosity panel" });
  await recordSampleReceipt(admin, trfA, sampleA, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
  await confirmTrfReceipt(admin, trfA);
  await saveAssessment(qa, trfA, sampleA, fullAssessment);
  await acceptSampleReview(qa, trfA, sampleA);
  const regA = await registerSample(admin, sampleA, emptyRegisterSampleInput());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sA = await (prisma.trfSample.findUnique({ where: { id: sampleA }, include: { tests: true } }) as any);
  const allocA = await allocateTest(admin, sA.tests[0].id, { ...emptyAllocateTestInput(), analystId: analyst.id, dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
  const wsA = await createWorksheet(admin, { testAllocationIds: [allocA.id] });
  await prepareWorksheet(admin, wsA.id);
  await assignWorksheet(admin, wsA.id);
  const resA = await saveResult(analyst, allocA.id, { ...emptyResultEntryInput(), resultValue: "6.8", unit: "pH units", testDate: new Date().toISOString().slice(0, 10) });
  await completeResult(analyst, allocA.id);
  await verifyResult(qa, resA.id, "Within specification limits");

  const repA = await createDraftReport(admin, { sampleRegistrationId: regA.id, testResultIds: [resA.id] });
  await generateDraftReport(admin, repA.id);
  await submitDraftReportForQa(admin, repA.id);
  await approveReport(qa, repA.id);
  await releaseReport(manager, repA.id, "Final QA and authorization complete.");
  await createDelivery(admin, repA.id, { deliveryMethod: "EMAIL", recipient: "quality@sundarpharma.example", notes: "Certificate of Analysis — released report" });

  const corrA = await requestCorrection(analyst, {
    draftReportId: repA.id, description: "pH value for Batch GL-204",
    originalValue: "6.8 pH units", correctedValue: "6.6 pH units",
    reason: "Transcription error found during routine post-release data verification — raw instrument log confirms 6.6.",
  });
  await startCorrectionReview(qa, corrA.id);
  await approveCorrection(qa, corrA.id, "Confirmed against raw instrument log.");
  await completeCorrection(qa, corrA.id);

  // ---------------------------------------------------------------------
  // Journey B — Kaveri Foods: microbiology sample mid-testing (demonstrates
  // "tests in progress" on the dashboard, handled by the Microbiology
  // Analyst role).
  // ---------------------------------------------------------------------
  const kaveriId = await customerIdFor("Kaveri Foods & Beverages");
  const quoB = await enquiryToAcceptedQuotation(admin, manager, kaveriId,
    { name: "Packaged Paneer — Retail Lot", category: "Dairy", tests: [{ serviceId: "microbial-analysis", requestedTest: "Total plate count & coliform screen" }] }, 2800);
  const { trfId: trfB, sampleId: sampleB } = await trfWithSample(admin, manager, kaveriId, quoB,
    { sampleName: "Packaged Paneer — Retail Lot KF-77", productCategory: "Dairy", serviceId: "microbial-analysis", requestedParameter: "Total plate count & coliform screen" });
  await recordSampleReceipt(admin, trfB, sampleB, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
  await confirmTrfReceipt(admin, trfB);
  await saveAssessment(qa, trfB, sampleB, fullAssessment);
  await acceptSampleReview(qa, trfB, sampleB);
  const regB = await registerSample(admin, sampleB, emptyRegisterSampleInput());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sB = await (prisma.trfSample.findUnique({ where: { id: sampleB }, include: { tests: true } }) as any);
  const allocB = await allocateTest(admin, sB.tests[0].id, { ...emptyAllocateTestInput(), analystId: micro.id, dueDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10) });
  const wsB = await createWorksheet(admin, { testAllocationIds: [allocB.id] });
  await prepareWorksheet(admin, wsB.id);
  await assignWorksheet(admin, wsB.id);
  void regB; // left registered + allocated + worksheet assigned — no result yet (testing in progress)

  // ---------------------------------------------------------------------
  // Journey C — GenNext Biotech: report sent for QA, awaiting decision
  // (demonstrates the "QA pending" dashboard metric).
  // ---------------------------------------------------------------------
  const genNextId = await customerIdFor("GenNext Biotech Labs");
  const quoC = await enquiryToAcceptedQuotation(admin, manager, genNextId,
    { name: "Fortified Protein Bar — Export Lot", category: "Nutraceuticals", tests: [{ serviceId: "nutritional-labeling", requestedTest: "Protein & calorie declaration" }] }, 3400);
  const { trfId: trfC, sampleId: sampleC } = await trfWithSample(admin, manager, genNextId, quoC,
    { sampleName: "Fortified Protein Bar — Export Lot GN-15", productCategory: "Nutraceuticals", serviceId: "nutritional-labeling", requestedParameter: "Protein & calorie declaration" });
  await recordSampleReceipt(admin, trfC, sampleC, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
  await confirmTrfReceipt(admin, trfC);
  await saveAssessment(qa, trfC, sampleC, fullAssessment);
  await acceptSampleReview(qa, trfC, sampleC);
  const regC = await registerSample(admin, sampleC, emptyRegisterSampleInput());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sC = await (prisma.trfSample.findUnique({ where: { id: sampleC }, include: { tests: true } }) as any);
  const allocC = await allocateTest(admin, sC.tests[0].id, { ...emptyAllocateTestInput(), analystId: analyst.id, dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) });
  const wsC = await createWorksheet(admin, { testAllocationIds: [allocC.id] });
  await prepareWorksheet(admin, wsC.id);
  await assignWorksheet(admin, wsC.id);
  const resC = await saveResult(analyst, allocC.id, { ...emptyResultEntryInput(), resultValue: "18.4", unit: "g/100g", testDate: new Date().toISOString().slice(0, 10) });
  await completeResult(analyst, allocC.id);
  await verifyResult(qa, resC.id, "Within declared range");
  const repC = await createDraftReport(admin, { sampleRegistrationId: regC.id, testResultIds: [resC.id] });
  await generateDraftReport(admin, repC.id);
  await submitDraftReportForQa(admin, repC.id);
  // Left at SENT_FOR_QA — awaiting a QA decision.
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForDemoSeed = globalThis as unknown as { __demoSeeded?: boolean };

export async function ensureDemoSeeded() {
  if (globalForDemoSeed.__demoSeeded) return;
  globalForDemoSeed.__demoSeeded = true;
  try {
    await seedDemoWorkflow();
  } catch (e) {
    globalForDemoSeed.__demoSeeded = false;
    console.error("[demo seed] failed:", e);
  }
}
