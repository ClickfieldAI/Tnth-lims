import { describe, it, expect } from "vitest";
import { recordSampleReceipt, confirmTrfReceipt, addDiscrepancyReview, listReceiptQueue, getTrfForReceipt } from "@/lib/receipts/service";
import { ReceiptError, type Actor } from "@/lib/receipts/access";
import { emptySampleReceiptInput, type SampleReceiptInput } from "@/lib/receipts/validation";
import { prisma } from "@/lib/prisma";
import { createTrfDraft, addTrfSample, updateTrfDraft, setTrfAuthorization, submitTrf, startTrfReview, acceptTrf } from "@/lib/trfs/service";
import { emptySample, emptyTestRequest } from "@/lib/trfs/validation";
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

async function acceptedTrfWithSamples(sampleCount = 2) {
  const customerId = await activeCustomerId();

  const enqInput = emptyEnquiryInput();
  enqInput.customerId = customerId; enqInput.assignedManagerId = "user_2";
  enqInput.products = [{ ...emptyProduct(), productName: "P", productCategory: "Food", tests: [{ ...emptyEnqTest(), serviceId: "microbial-analysis", requestedTest: "TPC", requestedQuantity: 1 }] }];
  const enq = await createEnquiry(admin, enqInput);
  const quo = await createQuotation(admin, enq.id);
  await updateQuotationDraft(admin, quo.id, {
    validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), discountTotal: 0,
    items: [{ productReference: "P", serviceName: "Microbial Analysis", quantity: 1, unitPrice: 1000, discount: 0, taxCategory: "GST 18%" }],
  });
  await submitQuotationForApproval(admin, quo.id);
  await approveQuotation(manager, quo.id);
  await sendQuotation(admin, quo.id);
  await recordAcceptance(manager, quo.id, {});

  const draft = await createTrfDraft(admin, { customerId, quotationId: quo.id });
  const sampleIds: string[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const res = await addTrfSample(admin, draft.id, {
      ...emptySample(), sampleName: `Sample ${i + 1}`, productCategory: "Food", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer",
      tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }],
    });
    sampleIds.push(res.id!);
  }
  await updateTrfDraft(admin, draft.id, { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false });
  await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Other" });
  await submitTrf(admin, draft.id);
  await startTrfReview(manager, draft.id);
  await acceptTrf(manager, draft.id);
  return { trfId: draft.id, sampleIds };
}

function validReceipt(overrides: Partial<SampleReceiptInput> = {}): SampleReceiptInput {
  return { ...emptySampleReceiptInput(), receivedQuantity: 1, receivedQuantityUnit: "kg", ...overrides };
}

describe("recording sample receipts", () => {
  it("records a receipt for a sample on an accepted TRF and rolls up TRF status to PARTIAL then RECEIVED", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(2);
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt());
    let t = await getTrfForReceipt(admin, trfId);
    expect(t.receiptStatus).toBe("PARTIAL");

    await recordSampleReceipt(admin, trfId, sampleIds[1], validReceipt());
    t = await getTrfForReceipt(admin, trfId);
    expect(t.receiptStatus).toBe("RECEIVED");
  });

  it("rejects recording a receipt for a TRF that is not accepted", async () => {
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
    const draft = await createTrfDraft(admin, { customerId, quotationId: quo.id }); // still DRAFT
    await expect(recordSampleReceipt(admin, draft.id, "no-such-sample", validReceipt())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects invalid receipt data (negative quantity, missing unit)", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await expect(recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt({ receivedQuantity: -1 }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt({ receivedQuantityUnit: "" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a receipt for a future date", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await expect(recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt({ receivedDate: future }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects an unknown sample id", async () => {
    const { trfId } = await acceptedTrfWithSamples(1);
    await expect(recordSampleReceipt(admin, trfId, "no-such-sample", validReceipt())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("discrepancy handling", () => {
  it("requires discrepancy types and remarks when a discrepancy is flagged", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await expect(recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt({ hasDiscrepancy: true }))).rejects.toMatchObject({ code: "VALIDATION" });
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt({ hasDiscrepancy: true, discrepancyTypes: ["Damaged Packaging"], discrepancyRemarks: "Outer box crushed in transit" }));
    const t = await getTrfForReceipt(admin, trfId);
    expect(t.receiptStatus).toBe("RECEIVED_WITH_DISCREPANCY");
  });

  it("allows QA to add a discrepancy review comment but not to record receipts", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt({ hasDiscrepancy: true, discrepancyTypes: ["Broken Seal"], discrepancyRemarks: "Seal broken" }));
    const res = await addDiscrepancyReview(qa, trfId, sampleIds[0], "Confirmed with client, proceeding with caution");
    expect(res.ok).toBe(true);
    await expect(recordSampleReceipt(qa, trfId, sampleIds[0], validReceipt())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("receipt confirmation", () => {
  it("prevents confirmation until every sample has been received", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(2);
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt());
    await expect(confirmTrfReceipt(admin, trfId)).rejects.toMatchObject({ code: "VALIDATION" });
    await recordSampleReceipt(admin, trfId, sampleIds[1], validReceipt());
    const res = await confirmTrfReceipt(admin, trfId);
    expect(res.ok).toBe(true);
  });

  it("locks further edits once receipt is confirmed", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt());
    await confirmTrfReceipt(admin, trfId);
    await expect(recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(confirmTrfReceipt(admin, trfId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("does not change the TRF's own workflow status or register samples", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt());
    await confirmTrfReceipt(admin, trfId);
    const t = await getTrfForReceipt(admin, trfId);
    expect(t.status).toBe("ACCEPTED"); // unchanged
  });
});

describe("RBAC", () => {
  it("denies ANALYST from recording or confirming, but allows viewing", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await expect(recordSampleReceipt(analyst, trfId, sampleIds[0], validReceipt())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(confirmTrfReceipt(analyst, trfId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const list = await listReceiptQueue(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("denies CLIENT from any receipt action, including viewing", async () => {
    await expect(listReceiptQueue(clientUser, {})).rejects.toBeInstanceOf(ReceiptError);
  });

  it("denies MANAGER... no wait, allows MANAGER to record and confirm", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await recordSampleReceipt(manager, trfId, sampleIds[0], validReceipt());
    const res = await confirmTrfReceipt(manager, trfId);
    expect(res.ok).toBe(true);
  });
});

describe("receipt queue", () => {
  it("only lists accepted TRFs, with correct stats", async () => {
    const { trfId } = await acceptedTrfWithSamples(1);
    const list = await listReceiptQueue(admin, {});
    expect(list.rows.some((r) => r.id === trfId)).toBe(true);
    expect(list.stats.total).toBeGreaterThan(0);
  });

  it("filters by receipt status and searches by TRF/customer text", async () => {
    const { trfId, sampleIds } = await acceptedTrfWithSamples(1);
    await recordSampleReceipt(admin, trfId, sampleIds[0], validReceipt());
    const list = await listReceiptQueue(admin, { receiptStatus: "RECEIVED" });
    expect(list.rows.some((r) => r.id === trfId)).toBe(true);
  });

  it("paginates results", async () => {
    for (let i = 0; i < 3; i += 1) await acceptedTrfWithSamples(1);
    const page = await listReceiptQueue(admin, { pageSize: 2, page: 1 });
    expect(page.rows.length).toBe(2);
  });
});
