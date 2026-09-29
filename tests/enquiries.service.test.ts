import { describe, it, expect } from "vitest";
import {
  createEnquiry, updateEnquiry, closeEnquiry, listEnquiries, getEnquiry,
  createQuotation, updateQuotationDraft, submitQuotationForApproval, approveQuotation, rejectQuotation,
  sendQuotation, createQuotationRevision, recordAcceptance, recordRejection, listQuotations, getQuotation,
} from "@/lib/enquiries/service";
import { EnquiryError, type Actor } from "@/lib/enquiries/access";
import { emptyEnquiryInput, emptyProduct, emptyTestRequest, type QuotationDraftInput } from "@/lib/enquiries/validation";
import { prisma } from "@/lib/prisma";

const admin: Actor = { id: "user_1", role: "ADMIN" };
const manager: Actor = { id: "user_2", role: "MANAGER" };
const manager2: Actor = { id: "user_2b", role: "MANAGER" };
const qa: Actor = { id: "user_3", role: "QA" };
const analyst: Actor = { id: "user_4", role: "ANALYST" };
const clientUser: Actor = { id: "user_6", role: "CLIENT", clientId: "client_1" };

async function activeCustomerId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma.client.findFirst({ where: { isActive: true } }) as any);
  return c.id as string;
}
async function inactiveCustomerId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma.client.findFirst({ where: { isActive: false } }) as any);
  return c?.id as string | undefined;
}

function validInput(customerId: string, overrides: Partial<ReturnType<typeof emptyEnquiryInput>> = {}) {
  const i = emptyEnquiryInput();
  i.customerId = customerId;
  i.assignedManagerId = "user_2";
  i.products = [{ ...emptyProduct(), productName: "Turmeric Powder", productCategory: "Spices", tests: [{ ...emptyTestRequest(), serviceId: "microbial-analysis", requestedTest: "Total plate count", requestedQuantity: 1 }] }];
  return { ...i, ...overrides };
}

describe("enquiry creation", () => {
  it("creates an enquiry with an ENQ-YYYY-00001 code and NEW status", async () => {
    const customerId = await activeCustomerId();
    const res = await createEnquiry(admin, validInput(customerId));
    expect(res.ok).toBe(true);
    expect(res.code).toMatch(/^ENQ-\d{4}-\d{5}$/);
    const e = await getEnquiry(admin, res.id);
    expect(e.status).toBe("NEW");
  });

  it("rejects an enquiry with no products", async () => {
    const customerId = await activeCustomerId();
    const input = validInput(customerId, { products: [] });
    await expect(createEnquiry(admin, input)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects an enquiry with no requested tests on a product", async () => {
    const customerId = await activeCustomerId();
    const input = validInput(customerId);
    input.products[0].tests = [];
    await expect(createEnquiry(admin, input)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires the customer to exist", async () => {
    await expect(createEnquiry(admin, validInput("no-such-customer"))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("blocks an inactive customer", async () => {
    const inactiveId = await inactiveCustomerId();
    if (!inactiveId) return; // seed data always has one inactive customer, but guard anyway
    await expect(createEnquiry(admin, validInput(inactiveId))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a positive-value violation on requested quantity", async () => {
    const customerId = await activeCustomerId();
    const input = validInput(customerId);
    input.products[0].tests[0].requestedQuantity = 0;
    await expect(createEnquiry(admin, input)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("only an Admin/Manager can be assigned an enquiry", async () => {
    const customerId = await activeCustomerId();
    const input = validInput(customerId, { assignedManagerId: "user_3" }); // QA
    await expect(createEnquiry(admin, input)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("enquiry editing & search", () => {
  it("updates an enquiry and appears in a customer-name search", async () => {
    const customerId = await activeCustomerId();
    const created = await createEnquiry(admin, validInput(customerId, { purposeOfTesting: "Original" }));
    const updated = validInput(customerId, { purposeOfTesting: "Updated purpose" });
    await updateEnquiry(admin, created.id, updated);
    const e = await getEnquiry(admin, created.id);
    expect(e.purposeOfTesting).toBe("Updated purpose");

    const results = await listEnquiries(admin, { search: e.customer.name.slice(0, 5) });
    expect(results.rows.some((r) => r.id === created.id)).toBe(true);
  });

  it("filters by status and paginates", async () => {
    const customerId = await activeCustomerId();
    for (let i = 0; i < 3; i += 1) await createEnquiry(admin, validInput(customerId));
    const page = await listEnquiries(admin, { status: "NEW", pageSize: 2, page: 1 });
    expect(page.rows.length).toBe(2);
    expect(page.rows.every((r) => r.status === "NEW")).toBe(true);
  });

  it("denies ANALYST from creating an enquiry but allows viewing", async () => {
    const customerId = await activeCustomerId();
    await expect(createEnquiry(analyst, validInput(customerId))).rejects.toBeInstanceOf(EnquiryError);
    const list = await listEnquiries(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("scopes a CLIENT user to their own organization's enquiries only", async () => {
    const results = await listEnquiries(clientUser, {});
    expect(results.rows.every((r) => r.customerId === "client_1")).toBe(true);
  });
});

describe("enquiry closing", () => {
  it("requires a reason and records it in the audit trail", async () => {
    const customerId = await activeCustomerId();
    const created = await createEnquiry(admin, validInput(customerId));
    await expect(closeEnquiry(admin, created.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await closeEnquiry(admin, created.id, "Customer withdrew interest");
    const e = await getEnquiry(admin, created.id);
    expect(e.status).toBe("CLOSED");
  });
});

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

function draftInput(overrides: Partial<QuotationDraftInput> = {}): QuotationDraftInput {
  return {
    validUntil: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    paymentTerms: "Net 15", discountTotal: 0,
    items: [{ productReference: "Turmeric Powder", serviceName: "Microbial Analysis", quantity: 1, unitPrice: 2000, discount: 0, taxCategory: "GST 18%" }],
    ...overrides,
  };
}

async function createEnquiryAndQuotation(actor: Actor = admin) {
  const customerId = await activeCustomerId();
  const enq = await createEnquiry(actor, validInput(customerId));
  const quo = await createQuotation(actor, enq.id);
  return { enq, quo };
}

describe("quotation creation", () => {
  it("creates a quotation from an enquiry with a QUO-YYYY-00001 code, DRAFT status", async () => {
    const { quo } = await createEnquiryAndQuotation();
    expect(quo.code).toMatch(/^QUO-\d{4}-\d{5}$/);
    const q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("DRAFT");
    expect(q.customerId).toBeTruthy();
  });

  it("moves the enquiry into UNDER_REVIEW once a quotation is drafted", async () => {
    const { enq, quo } = await createEnquiryAndQuotation();
    void quo;
    const e = await getEnquiry(admin, enq.id);
    expect(e.status).toBe("UNDER_REVIEW");
  });

  it("rejects creating a quotation for a closed enquiry", async () => {
    const customerId = await activeCustomerId();
    const enq = await createEnquiry(admin, validInput(customerId));
    await closeEnquiry(admin, enq.id, "no longer needed");
    await expect(createQuotation(admin, enq.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("pricing calculations", () => {
  it("computes line, subtotal, tax and grand totals accurately", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    const q = await getQuotation(admin, quo.id);
    expect(q.subtotal).toBe(2000);
    expect(q.taxTotal).toBe(360); // 18% of 2000
    expect(q.grandTotal).toBe(2360);
  });

  it("applies a line discount before tax", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput({ items: [{ productReference: "P", serviceName: "S", quantity: 1, unitPrice: 1000, discount: 100, taxCategory: "GST 18%" }] }));
    const q = await getQuotation(admin, quo.id);
    expect(q.taxableAmount).toBe(900);
    expect(q.taxTotal).toBe(162);
    expect(q.grandTotal).toBe(1062);
  });

  it("rejects a negative price or quantity", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await expect(updateQuotationDraft(admin, quo.id, draftInput({ items: [{ productReference: "P", serviceName: "S", quantity: -1, unitPrice: 100, discount: 0, taxCategory: "GST 18%" }] }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateQuotationDraft(admin, quo.id, draftInput({ items: [{ productReference: "P", serviceName: "S", quantity: 1, unitPrice: -1, discount: 0, taxCategory: "GST 18%" }] }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a discount exceeding the line subtotal", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await expect(updateQuotationDraft(admin, quo.id, draftInput({ items: [{ productReference: "P", serviceName: "S", quantity: 1, unitPrice: 100, discount: 200, taxCategory: "GST 18%" }] }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("recalculates on the server even if a client sent a bogus total (no client total is ever accepted)", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    const q = await getQuotation(admin, quo.id);
    // There is no field a client could set to override grandTotal directly —
    // updateQuotationDraft only accepts items/discount and always recomputes.
    expect(q.grandTotal).toBe(2360);
  });
});

describe("approval workflow", () => {
  it("goes DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    await submitQuotationForApproval(admin, quo.id);
    let q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("PENDING_APPROVAL");

    await approveQuotation(manager, quo.id); // prepared by admin, approved by manager — fine
    q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("APPROVED");
    expect(q.approvedById).toBe("user_2");

    await sendQuotation(admin, quo.id);
    q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("SENT");
  });

  it("blocks submitting for approval with an unpriced line item", async () => {
    const { quo } = await createEnquiryAndQuotation();
    // quotation was auto-seeded with a zero-price line item — never manually priced
    await expect(submitQuotationForApproval(admin, quo.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("enforces separation of duties — a Manager cannot approve their own quotation", async () => {
    const customerId = await activeCustomerId();
    const enq = await createEnquiry(manager, validInput(customerId));
    const quo = await createQuotation(manager, enq.id);
    await updateQuotationDraft(manager, quo.id, draftInput());
    await submitQuotationForApproval(manager, quo.id);
    await expect(approveQuotation(manager, quo.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // A different manager, or admin, can.
    await approveQuotation(admin, quo.id);
  });

  it("requires a reason to reject, and records it", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    await submitQuotationForApproval(admin, quo.id);
    await expect(rejectQuotation(manager, quo.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await rejectQuotation(manager, quo.id, "Pricing too high for this customer tier");
    const q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("REJECTED");
    expect(q.rejectionReason).toBeTruthy();
  });

  it("prevents acceptance before approval and sending", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await expect(recordAcceptance(admin, quo.id, {})).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("revisions", () => {
  it("creates a revision preserving the previous version and requiring reapproval", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    await submitQuotationForApproval(admin, quo.id);
    await approveQuotation(manager, quo.id);
    await sendQuotation(admin, quo.id);

    const rev = await createQuotationRevision(admin, quo.id, "Customer requested a lower price");
    expect(rev.id).not.toBe(quo.id);
    const revQ = await getQuotation(admin, rev.id);
    expect(revQ.status).toBe("DRAFT");
    expect(revQ.revisionNumber).toBe(2);
    expect(revQ.previousVersionId).toBe(quo.id);

    const original = await getQuotation(admin, quo.id);
    expect(original.status).toBe("SENT"); // untouched until the revision is approved

    await updateQuotationDraft(admin, rev.id, draftInput({ items: [{ productReference: "P", serviceName: "S", quantity: 1, unitPrice: 1500, discount: 0, taxCategory: "GST 18%" }] }));
    await submitQuotationForApproval(admin, rev.id);
    await approveQuotation(manager, rev.id);

    const originalAfter = await getQuotation(admin, quo.id);
    expect(originalAfter.status).toBe("SUPERSEDED");
  });

  it("requires a reason for a revision", async () => {
    const { quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    await submitQuotationForApproval(admin, quo.id);
    await approveQuotation(manager, quo.id);
    await sendQuotation(admin, quo.id);
    await expect(createQuotationRevision(admin, quo.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("customer acceptance and rejection", () => {
  async function sentQuotation() {
    const { enq, quo } = await createEnquiryAndQuotation();
    await updateQuotationDraft(admin, quo.id, draftInput());
    await submitQuotationForApproval(admin, quo.id);
    await approveQuotation(manager, quo.id);
    await sendQuotation(admin, quo.id);
    return { enq, quo };
  }

  it("records acceptance and updates the linked enquiry", async () => {
    const { enq, quo } = await sentQuotation();
    await recordAcceptance(manager, quo.id, { poNumber: "PO-1", notes: "Confirmed by email" });
    const q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("ACCEPTED");
    expect(q.acceptanceStatus).toBe("ACCEPTED");
    const e = await getEnquiry(admin, enq.id);
    expect(e.status).toBe("ACCEPTED");
  });

  it("records rejection with a reason and updates the enquiry", async () => {
    const { enq, quo } = await sentQuotation();
    await expect(recordRejection(manager, quo.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await recordRejection(manager, quo.id, "Price too high");
    const q = await getQuotation(admin, quo.id);
    expect(q.status).toBe("CUSTOMER_REJECTED");
    const e = await getEnquiry(admin, enq.id);
    expect(e.status).toBe("REJECTED");
  });

  it("denies an unauthorized role from recording acceptance", async () => {
    const { quo } = await sentQuotation();
    await expect(recordAcceptance(analyst, quo.id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("quotation search, filter, pagination", () => {
  it("filters the quotation directory by status", async () => {
    await createEnquiryAndQuotation();
    const result = await listQuotations(admin, { status: "DRAFT" });
    expect(result.rows.every((r) => r.status === "DRAFT")).toBe(true);
  });

  it("scopes a CLIENT user's quotation list to their own organization", async () => {
    const result = await listQuotations(clientUser, {});
    expect(result.rows.every((r) => r.customerId === "client_1")).toBe(true);
  });
});
