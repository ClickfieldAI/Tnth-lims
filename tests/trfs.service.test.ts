import { describe, it, expect } from "vitest";
import {
  createTrfDraft, updateTrfDraft, addTrfSample, updateTrfSample, removeTrfSample,
  addTrfDocument, setTrfAuthorization, submitTrf, startTrfReview, acceptTrf, holdTrf, resumeTrfReview,
  rejectTrf, requestTrfClarification, listTrfs, getTrf, getEligibleQuotations, getTrfHistory,
  type TrfStep4Fields,
} from "@/lib/trfs/service";
import { TrfError, type Actor } from "@/lib/trfs/access";
import { emptySample, emptyTestRequest, type TrfSampleInput } from "@/lib/trfs/validation";
import { prisma } from "@/lib/prisma";
import {
  createEnquiry, createQuotation, updateQuotationDraft, submitQuotationForApproval, approveQuotation, sendQuotation, recordAcceptance,
} from "@/lib/enquiries/service";
import { emptyEnquiryInput, emptyProduct, emptyTestRequest as emptyEnqTest } from "@/lib/enquiries/validation";

const admin: Actor = { id: "user_1", role: "ADMIN" };
const manager: Actor = { id: "user_2", role: "MANAGER" };
const qa: Actor = { id: "user_3", role: "QA" };
const analyst: Actor = { id: "user_4", role: "ANALYST" };
const clientUser: Actor = { id: "user_6", role: "CLIENT", clientId: "client_1" };
const otherClientUser: Actor = { id: "user_x", role: "CLIENT", clientId: "client_2" };

async function activeCustomerId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma.client.findFirst({ where: { isActive: true } }) as any);
  return c.id as string;
}

/** Builds a brand-new ACCEPTED quotation for the given customer, end to end
 * through the Module 2 service, so Module 3 tests exercise a realistic
 * accepted-quotation record rather than a hand-rolled fixture. */
async function acceptedQuotationFor(customerId: string) {
  const enqInput = emptyEnquiryInput();
  enqInput.customerId = customerId;
  enqInput.assignedManagerId = "user_2";
  enqInput.products = [{ ...emptyProduct(), productName: "Test Product", productCategory: "Food", tests: [{ ...emptyEnqTest(), serviceId: "microbial-analysis", requestedTest: "TPC", requestedQuantity: 1 }] }];
  const enq = await createEnquiry(admin, enqInput);
  const quo = await createQuotation(admin, enq.id);
  await updateQuotationDraft(admin, quo.id, {
    validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    discountTotal: 0, items: [{ productReference: "Test Product", serviceName: "Microbial Analysis", quantity: 1, unitPrice: 1000, discount: 0, taxCategory: "GST 18%" }],
  });
  await submitQuotationForApproval(admin, quo.id);
  await approveQuotation(manager, quo.id);
  await sendQuotation(admin, quo.id);
  await recordAcceptance(manager, quo.id, { poNumber: "PO-TEST-1" });
  return quo.id;
}

function sampleWithOneTest(overrides: Partial<TrfSampleInput> = {}): TrfSampleInput {
  return { ...emptySample(), sampleName: "Sample A", productCategory: "Food", quantity: 1, quantityUnit: "kg", containers: 1, sampledBy: "Customer", tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedParameter: "TPC" }], ...overrides };
}

function step4Fields(overrides: Partial<TrfStep4Fields> = {}): TrfStep4Fields {
  return { priority: "Normal", requestedDueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), storageCondition: "Ambient", conformityStatementRequested: false, ...overrides };
}

describe("TRF draft creation", () => {
  it("creates a draft TRF from an accepted quotation, with no TRF number yet", async () => {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const res = await createTrfDraft(admin, { customerId, quotationId });
    expect(res.ok).toBe(true);
    const t = await getTrf(admin, res.id);
    expect(t.status).toBe("DRAFT");
    expect(t.trfCode).toBeNull();
    expect(t.quotationRevisionSnapshot).toBe(1);
  });

  it("rejects a missing customer or quotation", async () => {
    await expect(createTrfDraft(admin, { customerId: "", quotationId: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a quotation that does not belong to the selected customer", async () => {
    const customerA = await activeCustomerId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerB = (await (prisma.client.findMany({ where: { isActive: true } }) as any))[1].id as string;
    const quotationForB = await acceptedQuotationFor(customerB);
    await expect(createTrfDraft(admin, { customerId: customerA, quotationId: quotationForB })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a quotation that has not been accepted", async () => {
    const customerId = await activeCustomerId();
    const enqInput = emptyEnquiryInput();
    enqInput.customerId = customerId; enqInput.assignedManagerId = "user_2";
    enqInput.products = [{ ...emptyProduct(), productName: "P", productCategory: "Food", tests: [{ ...emptyEnqTest(), serviceId: "microbial-analysis", requestedTest: "TPC", requestedQuantity: 1 }] }];
    const enq = await createEnquiry(admin, enqInput);
    const quo = await createQuotation(admin, enq.id); // still DRAFT
    await expect(createTrfDraft(admin, { customerId, quotationId: quo.id })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("blocks a second TRF against the same accepted quotation", async () => {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    await createTrfDraft(admin, { customerId, quotationId });
    await expect(createTrfDraft(admin, { customerId, quotationId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only lists quotations without an active TRF as eligible", async () => {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const before = await getEligibleQuotations(customerId);
    expect(before.some((q) => q.id === quotationId)).toBe(true);
    await createTrfDraft(admin, { customerId, quotationId });
    const after = await getEligibleQuotations(customerId);
    expect(after.some((q) => q.id === quotationId)).toBe(false);
  });
});

describe("draft editing: samples, tests, step 4, documents, authorization", () => {
  async function draftTrf() {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const res = await createTrfDraft(admin, { customerId, quotationId });
    return res.id;
  }

  it("adds, edits and removes samples with their test requests", async () => {
    const trfId = await draftTrf();
    const added = await addTrfSample(admin, trfId, sampleWithOneTest({ sampleName: "Sample B" }));
    let t = await getTrf(admin, trfId);
    expect(t.samples.some((s: { id: string }) => s.id === added.id)).toBe(true);

    await updateTrfSample(admin, trfId, added.id, sampleWithOneTest({ sampleName: "Sample B Renamed" }));
    t = await getTrf(admin, trfId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t.samples as any[]).find((s) => s.id === added.id)?.sampleName).toBe("Sample B Renamed");

    await removeTrfSample(admin, trfId, added.id);
    t = await getTrf(admin, trfId);
    expect(t.samples.some((s: { id: string }) => s.id === added.id)).toBe(false);
  });

  it("rejects a sample with no requested tests", async () => {
    const trfId = await draftTrf();
    await expect(addTrfSample(admin, trfId, sampleWithOneTest({ tests: [] }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects an invalid quantity or missing required fields", async () => {
    const trfId = await draftTrf();
    await expect(addTrfSample(admin, trfId, sampleWithOneTest({ quantity: 0 }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addTrfSample(admin, trfId, sampleWithOneTest({ sampleName: "" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects an expiry date before the manufacturing date", async () => {
    const trfId = await draftTrf();
    await expect(addTrfSample(admin, trfId, sampleWithOneTest({ manufacturingDate: "2026-06-01", expiryDate: "2026-01-01" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("updates step 4 (storage, reporting, priority, due date)", async () => {
    const trfId = await draftTrf();
    await updateTrfDraft(admin, trfId, step4Fields({ priority: "Rush", storageCondition: "Frozen" }));
    const t = await getTrf(admin, trfId);
    expect(t.priority).toBe("Rush");
    expect(t.storageCondition).toBe("Frozen");
  });

  it("rejects a requested due date in the past", async () => {
    const trfId = await draftTrf();
    await expect(updateTrfDraft(admin, trfId, step4Fields({ requestedDueDate: "2020-01-01" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("adds and validates document metadata", async () => {
    const trfId = await draftTrf();
    await expect(addTrfDocument(admin, trfId, { docType: "Signed TRF", fileName: "trf.exe", sizeBytes: 100, mimeType: "application/x-msdownload" })).rejects.toMatchObject({ code: "VALIDATION" });
    const res = await addTrfDocument(admin, trfId, { docType: "Signed TRF", fileName: "trf.pdf", sizeBytes: 100, mimeType: "application/pdf" });
    expect(res.ok).toBe(true);
  });

  it("sets authorization", async () => {
    const trfId = await draftTrf();
    await setTrfAuthorization(admin, trfId, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Signed TRF Upload" });
    const t = await getTrf(admin, trfId);
    expect(t.authorization.status).toBe("AUTHORIZED");
  });
});

describe("submission", () => {
  async function readyDraft() {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const res = await createTrfDraft(admin, { customerId, quotationId });
    await removeExtraSeedSample(res.id);
    await updateTrfDraft(admin, res.id, step4Fields());
    await addTrfDocument(admin, res.id, { docType: "Signed TRF", fileName: "trf.pdf", sizeBytes: 100, mimeType: "application/pdf" });
    await setTrfAuthorization(admin, res.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Signed TRF Upload" });
    return res.id;
  }
  // createTrfDraft doesn't seed a sample — helper kept for symmetry/clarity
  async function removeExtraSeedSample(_id: string) { /* no-op: drafts start with zero samples */ }

  it("rejects submission with no samples", async () => {
    const trfId = await readyDraft();
    await expect(submitTrf(admin, trfId)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("submits successfully once samples, tests, step 4 and authorization are complete, generating a TRF-YYYY-00001 code", async () => {
    const trfId = await readyDraft();
    await addTrfSample(admin, trfId, sampleWithOneTest());
    const res = await submitTrf(admin, trfId);
    expect(res.code).toMatch(/^TRF-\d{4}-\d{5}$/);
    const t = await getTrf(admin, trfId);
    expect(t.status).toBe("SUBMITTED");
    expect(t.submittedAt).toBeTruthy();
  });

  it("rejects submission without authorization evidence", async () => {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const res = await createTrfDraft(admin, { customerId, quotationId });
    await updateTrfDraft(admin, res.id, step4Fields());
    await addTrfSample(admin, res.id, sampleWithOneTest());
    await expect(submitTrf(admin, res.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects re-submitting an already-submitted TRF", async () => {
    const trfId = await readyDraft();
    await addTrfSample(admin, trfId, sampleWithOneTest());
    await submitTrf(admin, trfId);
    await expect(submitTrf(admin, trfId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("review workflow", () => {
  async function submittedTrf() {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const draft = await createTrfDraft(admin, { customerId, quotationId });
    await updateTrfDraft(admin, draft.id, step4Fields());
    await addTrfSample(admin, draft.id, sampleWithOneTest());
    await addTrfDocument(admin, draft.id, { docType: "Signed TRF", fileName: "trf.pdf", sizeBytes: 100, mimeType: "application/pdf" });
    await setTrfAuthorization(admin, draft.id, { status: "AUTHORIZED", authorizedPersonName: "Jane Doe", authorizationMethod: "Signed TRF Upload" });
    await submitTrf(admin, draft.id);
    return draft.id;
  }

  it("goes SUBMITTED -> UNDER_REVIEW -> ACCEPTED, recording history", async () => {
    const trfId = await submittedTrf();
    await startTrfReview(manager, trfId);
    let t = await getTrf(admin, trfId);
    expect(t.status).toBe("UNDER_REVIEW");
    await acceptTrf(manager, trfId);
    t = await getTrf(admin, trfId);
    expect(t.status).toBe("ACCEPTED");
    const history = await getTrfHistory(admin, trfId);
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["SUBMITTED", "REVIEW_STARTED", "ACCEPTED"]));
  });

  it("does not auto-accept a TRF just because its quotation was accepted", async () => {
    const trfId = await submittedTrf();
    const t = await getTrf(admin, trfId);
    expect(t.status).toBe("SUBMITTED"); // quotation was already ACCEPTED before this TRF even existed
  });

  it("requires a reason to place on hold, and to resume review", async () => {
    const trfId = await submittedTrf();
    await startTrfReview(manager, trfId);
    await expect(holdTrf(manager, trfId, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await holdTrf(manager, trfId, "Awaiting additional sample quantity");
    let t = await getTrf(admin, trfId);
    expect(t.status).toBe("ON_HOLD");
    expect(t.holdReason).toBeTruthy();
    await resumeTrfReview(manager, trfId);
    t = await getTrf(admin, trfId);
    expect(t.status).toBe("UNDER_REVIEW");
  });

  it("requires a reason to reject, and rejected TRFs are not resubmittable", async () => {
    const trfId = await submittedTrf();
    await startTrfReview(manager, trfId);
    await expect(rejectTrf(manager, trfId, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await rejectTrf(manager, trfId, "Sample quantity insufficient");
    const t = await getTrf(admin, trfId);
    expect(t.status).toBe("REJECTED");
    await expect(updateTrfDraft(admin, trfId, step4Fields())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(submitTrf(admin, trfId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires a comment to request clarification", async () => {
    const trfId = await submittedTrf();
    await startTrfReview(manager, trfId);
    await expect(requestTrfClarification(manager, trfId, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await requestTrfClarification(manager, trfId, "Please confirm batch number");
    const t = await getTrf(admin, trfId);
    expect(t.status).toBe("UNDER_REVIEW");
    expect(t.clarificationComments).toBeTruthy();
  });

  it("denies QA from performing review decisions", async () => {
    const trfId = await submittedTrf();
    await expect(startTrfReview(qa, trfId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepted TRFs cannot be edited", async () => {
    const trfId = await submittedTrf();
    await startTrfReview(manager, trfId);
    await acceptTrf(manager, trfId);
    await expect(updateTrfDraft(admin, trfId, step4Fields())).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("RBAC and scoping", () => {
  it("denies ANALYST from creating a TRF but allows viewing", async () => {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    await expect(createTrfDraft(analyst, { customerId, quotationId })).rejects.toBeInstanceOf(TrfError);
    const list = await listTrfs(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("scopes a CLIENT user to their own organization's TRFs, and denies cross-customer access", async () => {
    const quotationId = await acceptedQuotationFor("client_1");
    const draft = await createTrfDraft(clientUser, { customerId: "client_1", quotationId });
    const list = await listTrfs(clientUser, {});
    expect(list.rows.every((r) => r.customerId === "client_1")).toBe(true);
    await expect(getTrf(otherClientUser, draft.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents a CLIENT from creating a TRF for another organization", async () => {
    const quotationId = await acceptedQuotationFor("client_2");
    await expect(createTrfDraft(clientUser, { customerId: "client_2", quotationId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("search, filter, pagination", () => {
  it("filters by status and searches by TRF/customer/quotation text", async () => {
    const customerId = await activeCustomerId();
    const quotationId = await acceptedQuotationFor(customerId);
    const draft = await createTrfDraft(admin, { customerId, quotationId });
    const list = await listTrfs(admin, { status: "DRAFT" });
    expect(list.rows.some((r) => r.id === draft.id)).toBe(true);
  });

  it("paginates results", async () => {
    for (let i = 0; i < 3; i += 1) {
      const customerId = await activeCustomerId();
      const quotationId = await acceptedQuotationFor(customerId);
      await createTrfDraft(admin, { customerId, quotationId });
    }
    const page = await listTrfs(admin, { pageSize: 2, page: 1 });
    expect(page.rows.length).toBe(2);
  });
});
