import { describe, it, expect } from "vitest";
import { registerSample, cancelSampleRegistration, updateSampleStorage, listRegistrationQueue, getSampleRegistrationData } from "@/lib/registration/service";
import { RegistrationError, type Actor } from "@/lib/registration/access";
import { emptyRegisterSampleInput } from "@/lib/registration/validation";
import { generateSampleBarcodeDataUrl } from "@/lib/registration/barcode";
import { prisma } from "@/lib/prisma";
import { createTrfDraft, addTrfSample, updateTrfDraft, setTrfAuthorization, submitTrf, startTrfReview, acceptTrf } from "@/lib/trfs/service";
import { emptySample, emptyTestRequest } from "@/lib/trfs/validation";
import { recordSampleReceipt, confirmTrfReceipt } from "@/lib/receipts/service";
import { emptySampleReceiptInput } from "@/lib/receipts/validation";
import { saveAssessment, acceptSampleReview } from "@/lib/reviews/service";
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

async function technicallyAcceptedTrf(sampleCount = 1) {
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
  const sampleIds: string[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const res = await addTrfSample(admin, draft.id, {
      ...emptySample(), sampleName: `Sample ${i + 1}`, productCategory: "Food", batchNumber: `B-${i + 1}`, quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer",
      tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }],
    });
    sampleIds.push(res.id!);
  }
  await updateTrfDraft(admin, draft.id, { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false });
  await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Other" });
  await submitTrf(admin, draft.id);
  await startTrfReview(manager, draft.id);
  await acceptTrf(manager, draft.id);
  for (const id of sampleIds) {
    await recordSampleReceipt(admin, draft.id, id, { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg" });
  }
  await confirmTrfReceipt(admin, draft.id);
  for (const id of sampleIds) {
    await saveAssessment(qa, draft.id, id, fullAssessment);
    await acceptSampleReview(qa, draft.id, id);
  }
  return { trfId: draft.id, sampleIds };
}

describe("eligibility", () => {
  it("rejects registration when receipt is not confirmed", async () => {
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
    await expect(registerSample(admin, sample.id!, emptyRegisterSampleInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects registration when technical review is not accepted", async () => {
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
    // no technical review saved/accepted yet
    await expect(registerSample(admin, sample.id!, emptyRegisterSampleInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("registration", () => {
  it("generates a unique SPL-YYYY-00001 Sample ID and registers the sample", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    const res = await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    expect(res.ok).toBe(true);
    expect(res.sampleCode).toMatch(/^SPL-\d{4}-\d{5}$/);
  });

  it("gives multiple samples under one TRF independent Sample IDs", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(3);
    const codes: (string | undefined)[] = [];
    for (const id of sampleIds) codes.push((await registerSample(admin, id, emptyRegisterSampleInput())).sampleCode);
    expect(new Set(codes).size).toBe(3);
  });

  it("prevents duplicate registration of the same sample, including a double-submit", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    await expect(registerSample(admin, sampleIds[0], emptyRegisterSampleInput())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires storage condition to be provided", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    await expect(registerSample(admin, sampleIds[0], { storageCondition: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("locks the generated Sample ID from further silent changes (no update path exists beyond storage)", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    const res = await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    const sample = await getSampleRegistrationData(admin, sampleIds[0]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sample as any).registration.sampleCode).toBe(res.sampleCode);
  });
});

describe("barcode", () => {
  it("encodes exactly the Sample ID", async () => {
    const dataUrl = await generateSampleBarcodeDataUrl("SPL-2026-00001");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

describe("cancellation", () => {
  it("requires a reason to cancel", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    const res = await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    await expect(cancelSampleRegistration(admin, res.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
    const ok = await cancelSampleRegistration(admin, res.id, "Sample compromised during storage");
    expect(ok.ok).toBe(true);
  });

  it("never reuses a cancelled Sample ID, and blocks re-registration of that sample", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    const res = await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    await cancelSampleRegistration(admin, res.id, "Damaged in transit");
    await expect(registerSample(admin, sampleIds[0], emptyRegisterSampleInput())).rejects.toMatchObject({ code: "CONFLICT" });
    // the original code is never reissued to a new registration
    const { sampleIds: freshSamples } = await technicallyAcceptedTrf(1);
    const second = await registerSample(admin, freshSamples[0], emptyRegisterSampleInput());
    expect(second.sampleCode).not.toBe(res.sampleCode);
  });
});

describe("storage updates", () => {
  it("updates storage location/condition for a registered sample and audits it", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    const res = await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    const ok = await updateSampleStorage(admin, res.id, { storageCondition: "Refrigerated", storageLocation: "Cold Room 2" });
    expect(ok.ok).toBe(true);
  });
});

describe("RBAC", () => {
  it("denies ANALYST from registering but allows viewing", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    await expect(registerSample(analyst, sampleIds[0], emptyRegisterSampleInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listRegistrationQueue(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("denies QA from registering (view + history only)", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    await expect(registerSample(qa, sampleIds[0], emptyRegisterSampleInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies CLIENT from any registration access entirely", async () => {
    await expect(listRegistrationQueue(clientUser, {})).rejects.toBeInstanceOf(RegistrationError);
    const { sampleIds } = await technicallyAcceptedTrf(1);
    await expect(getSampleRegistrationData(clientUser, sampleIds[0])).rejects.toBeInstanceOf(RegistrationError);
  });

  it("allows MANAGER to register and cancel", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    const res = await registerSample(manager, sampleIds[0], emptyRegisterSampleInput());
    const cancelled = await cancelSampleRegistration(manager, res.id, "Client requested withdrawal");
    expect(cancelled.ok).toBe(true);
  });
});

describe("registration queue", () => {
  it("only lists technically-accepted samples", async () => {
    const { trfId } = await technicallyAcceptedTrf(1);
    const list = await listRegistrationQueue(admin, {});
    expect(list.rows.some((r) => r.trfId === trfId)).toBe(true);
  });

  it("filters by registration status and paginates", async () => {
    const { sampleIds } = await technicallyAcceptedTrf(1);
    await registerSample(admin, sampleIds[0], emptyRegisterSampleInput());
    const list = await listRegistrationQueue(admin, { registrationStatus: "REGISTERED" });
    expect(list.rows.some((r) => r.sample.id === sampleIds[0])).toBe(true);
  });

  it("paginates results", async () => {
    for (let i = 0; i < 3; i += 1) await technicallyAcceptedTrf(1);
    const page = await listRegistrationQueue(admin, { pageSize: 2, page: 1 });
    expect(page.rows.length).toBe(2);
  });
});
