// Enquiry & Quotation service layer — the authoritative server-side logic
// for Module 2. Mirrors lib/customers/service.ts: server actions call into
// this, never the other way around, and every permission/status/financial
// rule is enforced here (never trust the client).
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextEnquiryCode, nextQuotationCode } from "@/lib/ids";
import { EnquiryError, canEnquiry, canQuotation, canApproveQuotation, isClientScoped, type Actor } from "./access";
import {
  type EnquiryInput, type FieldErrors, validateEnquiry, ENQUIRY_STATUSES, type EnquiryStatus,
  type QuotationDraftInput, validateQuotationDraft, taxRateFor,
} from "./validation";

function assertEnquiry(actor: Actor, cap: Parameters<typeof canEnquiry>[1]) {
  if (!canEnquiry(actor, cap)) throw new EnquiryError("FORBIDDEN", "You do not have permission to perform this action.");
}
function assertQuotation(actor: Actor, cap: Parameters<typeof canQuotation>[1]) {
  if (!canQuotation(actor, cap)) throw new EnquiryError("FORBIDDEN", "You do not have permission to perform this action.");
}

function scopeWhere(actor: Actor): Record<string, unknown> | null {
  if (isClientScoped(actor)) {
    if (!actor.clientId) return { customerId: "__none__" };
    return { customerId: actor.clientId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export interface EnquiryListParams {
  search?: string;
  status?: string;
  customerId?: string;
  managerId?: string;
  quotationStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "enquiryCode" | "enquiryDate" | "status";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listEnquiries(actor: Actor, params: EnquiryListParams) {
  assertEnquiry(actor, "view");
  const scope = scopeWhere(actor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.enquiry.findMany({
    where: scope ?? undefined,
    include: { customer: true, assignedManager: true, products: { include: { tests: true } }, quotations: true },
  });

  const q = params.search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((e) =>
      [e.enquiryCode, e.customer?.name, e.customer?.code, e.customer?.contactPerson, ...e.products.map((p: { productName: string }) => p.productName)]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q)));
  }
  if (params.status) rows = rows.filter((e) => e.status === params.status);
  if (params.customerId) rows = rows.filter((e) => e.customerId === params.customerId);
  if (params.managerId) rows = rows.filter((e) => e.assignedManagerId === params.managerId);
  if (params.quotationStatus) rows = rows.filter((e) => e.quotations.some((q2: { status: string }) => q2.status === params.quotationStatus));
  if (params.dateFrom) rows = rows.filter((e) => e.enquiryDate >= new Date(params.dateFrom!));
  if (params.dateTo) rows = rows.filter((e) => e.enquiryDate <= new Date(params.dateTo! + "T23:59:59"));

  const sortBy = params.sortBy ?? "enquiryDate";
  const dir = params.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[sortBy]; const bv = b[sortBy];
    if (av instanceof Date && bv instanceof Date) return dir * (av.getTime() - bv.getTime());
    return dir * String(av).localeCompare(String(bv));
  });

  const total = rows.length;
  const pageSize = params.pageSize ?? 10;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    rows: pageRows,
    total, page, pageSize,
    stats: {
      total: rows.length,
      new: rows.filter((e) => e.status === "NEW").length,
      pendingQuotation: rows.filter((e) => ["UNDER_REVIEW", "QUOTATION_IN_PROGRESS", "QUOTATION_SENT"].includes(e.status)).length,
      accepted: rows.filter((e) => e.status === "ACCEPTED").length,
      rejectedClosed: rows.filter((e) => ["REJECTED", "CLOSED"].includes(e.status)).length,
    },
  };
}

export async function getEnquiry(actor: Actor, id: string) {
  assertEnquiry(actor, "view");
  const scope = scopeWhere(actor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = await prisma.enquiry.findUnique({
    where: { id },
    include: { customer: true, assignedManager: true, products: { include: { tests: true } }, quotations: { include: { items: true } } },
  }) as any;
  if (!e) throw new EnquiryError("NOT_FOUND", "Enquiry not found.");
  if (scope && e.customerId !== actor.clientId) throw new EnquiryError("FORBIDDEN", "Not your organization's enquiry.");
  return e;
}

async function assertCustomerUsable(customerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = await prisma.client.findUnique({ where: { id: customerId } }) as any;
  if (!customer) throw new EnquiryError("VALIDATION", "Select a valid customer.", { customerId: "Customer not found." });
  if (!customer.isActive) throw new EnquiryError("VALIDATION", "Inactive customers cannot be selected for a new enquiry.", { customerId: "This customer is inactive." });
  return customer;
}

async function assertManagerUsable(managerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manager = await prisma.user.findUnique({ where: { id: managerId }, include: { role: true } }) as any;
  if (!manager || !manager.isActive) throw new EnquiryError("VALIDATION", "Assigned manager not found.", { assignedManagerId: "Select a valid user." });
  if (!["ADMIN", "MANAGER"].includes(manager.role.name)) {
    throw new EnquiryError("VALIDATION", "The assigned user must be an Admin or Lab Manager.", { assignedManagerId: "This user cannot be assigned enquiries." });
  }
  return manager;
}

export async function createEnquiry(actor: Actor, input: EnquiryInput) {
  assertEnquiry(actor, "create");
  const errors = validateEnquiry(input);
  if (Object.keys(errors).length) throw new EnquiryError("VALIDATION", "Please fix the highlighted fields.", errors);

  await assertCustomerUsable(input.customerId);
  await assertManagerUsable(input.assignedManagerId);

  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await prisma.enquiry.count({});
  const code = nextEnquiryCode(count + 1);

  const created = await prisma.enquiry.create({
    data: {
      enquiryCode: code, customerId: input.customerId, enquiryDate: new Date(input.enquiryDate),
      enquirySource: input.enquirySource, assignedManagerId: input.assignedManagerId, priority: input.priority,
      status: "NEW", requestedTurnaroundDays: input.requestedTurnaroundDays,
      purposeOfTesting: input.purposeOfTesting ?? "", regulatoryRequirements: input.regulatoryRequirements ?? "",
      requiredReportingFormat: input.requiredReportingFormat ?? "", requiredAccreditation: input.requiredAccreditation ?? "",
      reportDeliveryMethod: input.reportDeliveryMethod ?? "", customerNotes: input.customerNotes ?? "",
      createdById: actor.id, updatedById: actor.id, createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  for (const p of input.products) {
    const product = await prisma.enquiryProduct.create({
      data: {
        enquiryId: created.id, productName: p.productName, productCategory: p.productCategory,
        productDescription: p.productDescription ?? "", batchNumber: p.batchNumber ?? "",
        sampleType: p.sampleType ?? "", sampleMatrix: p.sampleMatrix ?? "",
        quantity: p.quantity ?? null, quantityUnit: p.quantityUnit ?? "",
        packagingDetails: p.packagingDetails ?? "", storageRequirements: p.storageRequirements ?? "",
        specialHandlingInstructions: p.specialHandlingInstructions ?? "",
        requestedTestingDate: p.requestedTestingDate ? new Date(p.requestedTestingDate) : null,
        notes: p.notes ?? "", createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    for (const t of p.tests) {
      await prisma.enquiryTestRequest.create({
        data: {
          enquiryProductId: product.id, serviceId: t.customRequest ? null : t.serviceId,
          customRequest: t.customRequest, customServiceName: t.customRequest ? (t.customServiceName ?? "") : null,
          requestedTest: t.requestedTest, requestedMethod: t.requestedMethod ?? "", specification: t.specification ?? "",
          requestedQuantity: t.requestedQuantity, specialRequirements: t.specialRequirements ?? "",
          estimatedTurnaroundDays: t.estimatedTurnaroundDays ?? null, createdAt: now, updatedAt: now,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    }
  }

  await logAudit(actor.id, { action: "ENQUIRY_CREATED", module: "enquiries", entityType: "enquiry", entityId: created.id, oldValue: null, newValue: { code, customerId: input.customerId } });
  return { ok: true as const, id: created.id, code };
}

export async function updateEnquiry(actor: Actor, id: string, input: EnquiryInput) {
  assertEnquiry(actor, "edit");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.enquiry.findUnique({ where: { id } }) as any;
  if (!existing) throw new EnquiryError("NOT_FOUND", "Enquiry not found.");
  if (["ACCEPTED", "REJECTED", "CLOSED"].includes(existing.status)) {
    throw new EnquiryError("CONFLICT", `A ${existing.status.toLowerCase()} enquiry cannot be edited.`);
  }

  const errors = validateEnquiry(input);
  if (Object.keys(errors).length) throw new EnquiryError("VALIDATION", "Please fix the highlighted fields.", errors);
  await assertCustomerUsable(input.customerId);
  await assertManagerUsable(input.assignedManagerId);

  const now = new Date();
  const oldSnapshot = { ...existing };
  await prisma.enquiry.update({
    where: { id },
    data: {
      customerId: input.customerId, enquiryDate: new Date(input.enquiryDate), enquirySource: input.enquirySource,
      assignedManagerId: input.assignedManagerId, priority: input.priority, requestedTurnaroundDays: input.requestedTurnaroundDays,
      purposeOfTesting: input.purposeOfTesting ?? "", regulatoryRequirements: input.regulatoryRequirements ?? "",
      requiredReportingFormat: input.requiredReportingFormat ?? "", requiredAccreditation: input.requiredAccreditation ?? "",
      reportDeliveryMethod: input.reportDeliveryMethod ?? "", customerNotes: input.customerNotes ?? "",
      updatedById: actor.id, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  // Products/tests are replaced wholesale on edit — simplest correct approach
  // for an in-memory store; the audit entry preserves the prior snapshot.
  const oldProducts = await prisma.enquiryProduct.findMany({ where: { enquiryId: id }, include: { tests: true } });
  for (const p of oldProducts) {
    await prisma.enquiryTestRequest.deleteMany({ where: { enquiryProductId: p.id } });
  }
  await prisma.enquiryProduct.deleteMany({ where: { enquiryId: id } });
  for (const p of input.products) {
    const product = await prisma.enquiryProduct.create({
      data: {
        enquiryId: id, productName: p.productName, productCategory: p.productCategory,
        productDescription: p.productDescription ?? "", batchNumber: p.batchNumber ?? "",
        sampleType: p.sampleType ?? "", sampleMatrix: p.sampleMatrix ?? "",
        quantity: p.quantity ?? null, quantityUnit: p.quantityUnit ?? "",
        packagingDetails: p.packagingDetails ?? "", storageRequirements: p.storageRequirements ?? "",
        specialHandlingInstructions: p.specialHandlingInstructions ?? "",
        requestedTestingDate: p.requestedTestingDate ? new Date(p.requestedTestingDate) : null,
        notes: p.notes ?? "", createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    for (const t of p.tests) {
      await prisma.enquiryTestRequest.create({
        data: {
          enquiryProductId: product.id, serviceId: t.customRequest ? null : t.serviceId,
          customRequest: t.customRequest, customServiceName: t.customRequest ? (t.customServiceName ?? "") : null,
          requestedTest: t.requestedTest, requestedMethod: t.requestedMethod ?? "", specification: t.specification ?? "",
          requestedQuantity: t.requestedQuantity, specialRequirements: t.specialRequirements ?? "",
          estimatedTurnaroundDays: t.estimatedTurnaroundDays ?? null, createdAt: now, updatedAt: now,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    }
  }

  await logAudit(actor.id, { action: "ENQUIRY_UPDATED", module: "enquiries", entityType: "enquiry", entityId: id, oldValue: oldSnapshot, newValue: input });
  return { ok: true as const, id, code: existing.enquiryCode };
}

// Status transitions allowed to happen explicitly (via user action). Most
// forward transitions (NEW -> UNDER_REVIEW -> QUOTATION_IN_PROGRESS ->
// QUOTATION_SENT -> ACCEPTED/REJECTED) are driven automatically by quotation
// lifecycle events below, never by direct user choice — this matrix is only
// for the explicit "Close Enquiry" action.
const CLOSEABLE_FROM: EnquiryStatus[] = ["DRAFT", "NEW", "UNDER_REVIEW", "QUOTATION_IN_PROGRESS", "QUOTATION_SENT", "REJECTED"];

export async function closeEnquiry(actor: Actor, id: string, reason: string) {
  assertEnquiry(actor, "close");
  if (!reason.trim()) throw new EnquiryError("VALIDATION", "A reason is required to close an enquiry.", { reason: "Required" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.enquiry.findUnique({ where: { id } }) as any;
  if (!existing) throw new EnquiryError("NOT_FOUND", "Enquiry not found.");
  if (existing.status === "ACCEPTED") throw new EnquiryError("CONFLICT", "An accepted enquiry cannot be closed directly.");
  if (existing.status === "CLOSED") return { ok: true as const };
  if (!CLOSEABLE_FROM.includes(existing.status)) throw new EnquiryError("CONFLICT", `Cannot close an enquiry in ${existing.status} status.`);

  await prisma.enquiry.update({ where: { id }, data: { status: "CLOSED", updatedById: actor.id, updatedAt: new Date() } });
  await logAudit(actor.id, { action: "ENQUIRY_CLOSED", module: "enquiries", entityType: "enquiry", entityId: id, oldValue: { status: existing.status }, newValue: { status: "CLOSED", reason } });
  return { ok: true as const };
}

async function setEnquiryStatus(actor: Actor | null, enquiryId: string, status: EnquiryStatus) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = await prisma.enquiry.findUnique({ where: { id: enquiryId } }) as any;
  if (!e || e.status === status) return;
  await prisma.enquiry.update({ where: { id: enquiryId }, data: { status, updatedAt: new Date() } });
  await logAudit(actor?.id ?? null, { action: "ENQUIRY_STATUS_CHANGED", module: "enquiries", entityType: "enquiry", entityId: enquiryId, oldValue: { status: e.status }, newValue: { status } });
}

export { ENQUIRY_STATUSES };

// ---------------------------------------------------------------------------
// Quotations — financial helpers (integer-paise arithmetic; never floats
// chained across operations, to avoid rounding drift on the grand total)
// ---------------------------------------------------------------------------

const toPaise = (rupees: number) => Math.round(rupees * 100);
const fromPaise = (paise: number) => Math.round(paise) / 100;

function computeTotals(items: QuotationDraftInput["items"], overallDiscountRupees: number) {
  let subtotalP = 0;
  let lineDiscountP = 0;
  let taxP = 0;
  const lineTotals: { taxAmount: number; lineTotal: number }[] = [];

  for (const it of items) {
    const lineSubtotalP = toPaise(it.quantity * it.unitPrice);
    const lineDiscP = Math.min(toPaise(it.discount), lineSubtotalP);
    subtotalP += lineSubtotalP;
    lineDiscountP += lineDiscP;
    const taxRate = taxRateFor(it.taxCategory);
    const taxableLineP = lineSubtotalP - lineDiscP;
    const lineTaxP = taxRate ? Math.round(taxableLineP * (taxRate / 100)) : 0;
    taxP += lineTaxP;
    lineTotals.push({ taxAmount: fromPaise(lineTaxP), lineTotal: fromPaise(taxableLineP + lineTaxP) });
  }

  const overallDiscP = Math.min(toPaise(overallDiscountRupees), Math.max(0, subtotalP - lineDiscountP));
  const taxableP = Math.max(0, subtotalP - lineDiscountP - overallDiscP);
  // Overall discount is applied after per-line tax has already been computed
  // on line amounts (line-level tax is a snapshot of each line); this keeps
  // the arithmetic simple and auditable rather than re-deriving per-line tax
  // proportionally, which would invent precision the source data doesn't have.
  return {
    subtotal: fromPaise(subtotalP),
    discountTotal: fromPaise(lineDiscountP + overallDiscP),
    taxableAmount: fromPaise(taxableP),
    taxTotal: fromPaise(taxP),
    grandTotal: fromPaise(taxableP + taxP),
    lineTotals,
  };
}

export async function createQuotation(actor: Actor, enquiryId: string) {
  assertQuotation(actor, "create");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enq = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { products: { include: { tests: true } }, quotations: true },
  }) as any;
  if (!enq) throw new EnquiryError("NOT_FOUND", "Enquiry not found.");
  if (["ACCEPTED", "REJECTED", "CLOSED"].includes(enq.status)) {
    throw new EnquiryError("CONFLICT", `Cannot create a quotation for a ${enq.status.toLowerCase()} enquiry.`);
  }

  const now = new Date();
  const count = await prisma.quotation.count({});
  const code = nextQuotationCode(count + 1);

  const created = await prisma.quotation.create({
    data: {
      quotationCode: code, enquiryId, customerId: enq.customerId,
      quotationDate: now, validUntil: new Date(now.getTime() + 30 * 86400000),
      revisionNumber: 1, previousVersionId: null, status: "DRAFT",
      subtotal: 0, discountTotal: 0, taxableAmount: 0, taxTotal: 0, grandTotal: 0, currency: "INR",
      paymentTerms: "", advancePaymentRequired: false, poRequired: false, billingNotes: "",
      preparedById: actor.id, approvedById: null, approvedAt: null, sentAt: null,
      acceptanceStatus: "PENDING", acceptanceDate: null, acceptedById: null, poNumber: null, acceptanceNotes: null,
      rejectionReason: null, revisionReason: null, createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  // Seed one draft line item per requested test — price left at 0, requiring
  // an authorized user to enter it manually (never invent a price).
  for (const p of enq.products) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of p.tests as any[]) {
      await prisma.quotationItem.create({
        data: {
          quotationId: created.id, testRequestId: t.id, productReference: p.productName,
          serviceName: t.customRequest ? (t.customServiceName || "Custom request (pending review)") : t.requestedTest,
          method: t.requestedMethod || "", quantity: t.requestedQuantity || 1, unitPrice: 0, discount: 0,
          taxCategory: "Pending Configuration", taxAmount: 0, lineTotal: 0,
          estimatedTurnaroundDays: t.estimatedTurnaroundDays ?? enq.requestedTurnaroundDays,
          createdAt: now, updatedAt: now,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    }
  }

  await setEnquiryStatus(actor, enquiryId, enq.status === "NEW" ? "UNDER_REVIEW" : enq.status);
  await logAudit(actor.id, { action: "QUOTATION_CREATED", module: "quotations", entityType: "quotation", entityId: created.id, oldValue: null, newValue: { code, enquiryId } });
  return { ok: true as const, id: created.id, code };
}

export async function getQuotation(actor: Actor, id: string) {
  assertQuotation(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: { enquiry: { include: { customer: true } }, customer: true, items: true, preparedBy: true, approvedBy: true },
  }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (isClientScoped(actor) && q.customerId !== actor.clientId) throw new EnquiryError("FORBIDDEN", "Not your organization's quotation.");
  return q;
}

export async function listQuotations(actor: Actor, params: { search?: string; status?: string; acceptanceStatus?: string; customerId?: string; managerId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }) {
  assertQuotation(actor, "view");
  const scope = isClientScoped(actor) ? { customerId: actor.clientId ?? "__none__" } : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.quotation.findMany({ where: scope, include: { customer: true, enquiry: true, preparedBy: true } });

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.quotationCode, r.enquiry?.enquiryCode, r.customer?.name].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  if (params.acceptanceStatus) rows = rows.filter((r) => r.acceptanceStatus === params.acceptanceStatus);
  if (params.customerId) rows = rows.filter((r) => r.customerId === params.customerId);
  if (params.managerId) rows = rows.filter((r) => r.enquiry?.assignedManagerId === params.managerId);
  if (params.dateFrom) rows = rows.filter((r) => r.quotationDate >= new Date(params.dateFrom!));
  if (params.dateTo) rows = rows.filter((r) => r.quotationDate <= new Date(params.dateTo! + "T23:59:59"));

  // Compute EXPIRED transparently for display/filtering without silently
  // mutating history — persisted only via `refreshExpiry` below.
  const today = new Date();
  rows = rows.map((r) => ({ ...r, effectiveStatus: (["SENT", "APPROVED"].includes(r.status) && r.validUntil < today) ? "EXPIRED" : r.status }));

  rows.sort((a, b) => b.quotationDate.getTime() - a.quotationDate.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 10;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      draft: rows.filter((r) => r.status === "DRAFT").length,
      pendingApproval: rows.filter((r) => r.status === "PENDING_APPROVAL").length,
      sent: rows.filter((r) => r.status === "SENT").length,
      accepted: rows.filter((r) => r.status === "ACCEPTED").length,
      expiringSoon: rows.filter((r) => r.effectiveStatus === "SENT" && r.validUntil.getTime() - today.getTime() < 5 * 86400000).length,
    },
  };
}

/** Persists the EXPIRED transition for SENT/APPROVED quotations past validity. Safe to call opportunistically. */
export async function refreshExpiry(quotationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id: quotationId } }) as any;
  if (!q) return;
  if (["SENT", "APPROVED"].includes(q.status) && q.validUntil < new Date()) {
    await prisma.quotation.update({ where: { id: quotationId }, data: { status: "EXPIRED" } });
    await logAudit(null, { action: "QUOTATION_EXPIRED", module: "quotations", entityType: "quotation", entityId: quotationId, oldValue: { status: q.status }, newValue: { status: "EXPIRED" } });
  }
}

export async function updateQuotationDraft(actor: Actor, id: string, input: QuotationDraftInput) {
  assertQuotation(actor, "edit");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (!["DRAFT", "REJECTED"].includes(q.status)) throw new EnquiryError("CONFLICT", "Only a draft or rejected quotation can be edited directly — create a revision instead.");

  const errors = validateQuotationDraft(input, q.quotationDate);
  if (Object.keys(errors).length) throw new EnquiryError("VALIDATION", "Please fix the highlighted fields.", errors);

  const totals = computeTotals(input.items, input.discountTotal);
  const oldSnapshot = { status: q.status, grandTotal: q.grandTotal };

  await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
  const now = new Date();
  for (let i = 0; i < input.items.length; i += 1) {
    const it = input.items[i];
    const t = totals.lineTotals[i];
    await prisma.quotationItem.create({
      data: {
        quotationId: id, testRequestId: it.testRequestId ?? null, productReference: it.productReference,
        serviceName: it.serviceName, method: it.method ?? "", quantity: it.quantity, unitPrice: it.unitPrice,
        discount: it.discount, taxCategory: it.taxCategory, taxAmount: t.taxAmount, lineTotal: t.lineTotal,
        estimatedTurnaroundDays: it.estimatedTurnaroundDays ?? null, createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }

  await prisma.quotation.update({
    where: { id },
    data: {
      validUntil: new Date(input.validUntil), paymentTerms: input.paymentTerms ?? "",
      advancePaymentRequired: !!input.advancePaymentRequired, poRequired: !!input.poRequired, billingNotes: input.billingNotes ?? "",
      subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxableAmount: totals.taxableAmount,
      taxTotal: totals.taxTotal, grandTotal: totals.grandTotal, status: "DRAFT", updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  await logAudit(actor.id, { action: "QUOTATION_UPDATED", module: "quotations", entityType: "quotation", entityId: id, oldValue: oldSnapshot, newValue: { grandTotal: totals.grandTotal } });
  return { ok: true as const, id };
}

export async function submitQuotationForApproval(actor: Actor, id: string) {
  assertQuotation(actor, "edit");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: true } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (!["DRAFT", "REJECTED"].includes(q.status)) throw new EnquiryError("CONFLICT", "Only a draft or rejected quotation can be submitted for approval.");
  if (!q.items.length) throw new EnquiryError("VALIDATION", "Add at least one priced line item first.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (q.items.some((it: any) => it.unitPrice <= 0)) throw new EnquiryError("VALIDATION", "Every line item needs a unit price before submitting for approval.");

  await prisma.quotation.update({ where: { id }, data: { status: "PENDING_APPROVAL", updatedAt: new Date() } });
  await setEnquiryStatus(actor, q.enquiryId, "QUOTATION_IN_PROGRESS");
  await logAudit(actor.id, { action: "QUOTATION_SUBMITTED", module: "quotations", entityType: "quotation", entityId: id, oldValue: { status: q.status }, newValue: { status: "PENDING_APPROVAL" } });
  return { ok: true as const };
}

export async function approveQuotation(actor: Actor, id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (q.status !== "PENDING_APPROVAL") throw new EnquiryError("CONFLICT", "Only a quotation pending approval can be approved.");
  if (!canApproveQuotation(actor, q.preparedById)) throw new EnquiryError("FORBIDDEN", "You cannot approve a quotation you prepared yourself, or you lack approval rights.");

  await prisma.quotation.update({ where: { id }, data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), updatedAt: new Date() } });
  if (q.previousVersionId) {
    await prisma.quotation.update({ where: { id: q.previousVersionId }, data: { status: "SUPERSEDED", updatedAt: new Date() } });
    await logAudit(actor.id, { action: "QUOTATION_SUPERSEDED", module: "quotations", entityType: "quotation", entityId: q.previousVersionId, oldValue: null, newValue: { supersededBy: id } });
  }
  await logAudit(actor.id, { action: "QUOTATION_APPROVED", module: "quotations", entityType: "quotation", entityId: id, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "APPROVED", approvedBy: actor.id } });
  return { ok: true as const };
}

export async function rejectQuotation(actor: Actor, id: string, reason: string) {
  if (!reason.trim()) throw new EnquiryError("VALIDATION", "A reason is required to reject a quotation.", { reason: "Required" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (q.status !== "PENDING_APPROVAL") throw new EnquiryError("CONFLICT", "Only a quotation pending approval can be rejected.");
  if (!canApproveQuotation(actor, q.preparedById)) throw new EnquiryError("FORBIDDEN", "You cannot decide on a quotation you prepared yourself, or you lack approval rights.");

  await prisma.quotation.update({ where: { id }, data: { status: "REJECTED", rejectionReason: reason, updatedAt: new Date() } });
  await logAudit(actor.id, { action: "QUOTATION_REJECTED", module: "quotations", entityType: "quotation", entityId: id, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "REJECTED", reason } });
  return { ok: true as const };
}

export async function sendQuotation(actor: Actor, id: string) {
  assertQuotation(actor, "send");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (q.status !== "APPROVED") throw new EnquiryError("CONFLICT", "Only an approved quotation can be sent.");
  if (q.validUntil < new Date()) throw new EnquiryError("CONFLICT", "This quotation has already expired and cannot be sent as-is — create a revision.");

  await prisma.quotation.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), updatedAt: new Date() } });
  await setEnquiryStatus(actor, q.enquiryId, "QUOTATION_SENT");
  await logAudit(actor.id, { action: "QUOTATION_SENT", module: "quotations", entityType: "quotation", entityId: id, oldValue: { status: "APPROVED" }, newValue: { status: "SENT" } });
  return { ok: true as const };
}

export async function createQuotationRevision(actor: Actor, id: string, reason: string) {
  assertQuotation(actor, "revise");
  if (!reason.trim()) throw new EnquiryError("VALIDATION", "A reason is required to create a revision.", { reason: "Required" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: true } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (!["SENT", "APPROVED", "REJECTED", "EXPIRED", "CUSTOMER_REJECTED"].includes(q.status)) {
    throw new EnquiryError("CONFLICT", `Cannot revise a quotation in ${q.status} status.`);
  }

  const now = new Date();
  const revised = await prisma.quotation.create({
    data: {
      quotationCode: q.quotationCode, enquiryId: q.enquiryId, customerId: q.customerId,
      quotationDate: now, validUntil: new Date(now.getTime() + 30 * 86400000),
      revisionNumber: q.revisionNumber + 1, previousVersionId: q.id, status: "DRAFT",
      subtotal: q.subtotal, discountTotal: q.discountTotal, taxableAmount: q.taxableAmount, taxTotal: q.taxTotal, grandTotal: q.grandTotal,
      currency: q.currency, paymentTerms: q.paymentTerms, advancePaymentRequired: q.advancePaymentRequired, poRequired: q.poRequired,
      billingNotes: q.billingNotes, preparedById: actor.id, approvedById: null, approvedAt: null, sentAt: null,
      acceptanceStatus: "PENDING", acceptanceDate: null, acceptedById: null, poNumber: null, acceptanceNotes: null,
      rejectionReason: null, revisionReason: reason, createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of q.items as any[]) {
    await prisma.quotationItem.create({
      data: {
        quotationId: revised.id, testRequestId: it.testRequestId, productReference: it.productReference,
        serviceName: it.serviceName, method: it.method, quantity: it.quantity, unitPrice: it.unitPrice,
        discount: it.discount, taxCategory: it.taxCategory, taxAmount: it.taxAmount, lineTotal: it.lineTotal,
        estimatedTurnaroundDays: it.estimatedTurnaroundDays, createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }

  await prisma.quotationHistory.create({
    data: { quotationId: revised.id, revisionNumber: revised.revisionNumber, previousVersionReference: q.id, revisionReason: reason, snapshot: { subtotal: q.subtotal, grandTotal: q.grandTotal, status: q.status }, createdById: actor.id, createdAt: now },
  });
  await logAudit(actor.id, { action: "QUOTATION_REVISION_CREATED", module: "quotations", entityType: "quotation", entityId: revised.id, oldValue: { previousVersion: q.id, previousStatus: q.status }, newValue: { revisionNumber: revised.revisionNumber, reason } });
  // NOTE: the previous version is marked SUPERSEDED once this revision is
  // approved (see approveQuotation) — not here — so an issued version is
  // never silently replaced while the revision is still just a draft.
  return { ok: true as const, id: revised.id, code: revised.quotationCode };
}

export async function getQuotationHistory(actor: Actor, quotationId: string) {
  assertQuotation(actor, "history");
  return prisma.quotationHistory.findMany({ where: { quotationId }, include: { createdBy: true } });
}

export interface AcceptanceInput { poNumber?: string; notes?: string }

export async function recordAcceptance(actor: Actor, id: string, input: AcceptanceInput) {
  assertQuotation(actor, "recordAcceptance");
  await refreshExpiry(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (q.status === "EXPIRED") throw new EnquiryError("CONFLICT", "This quotation has expired and cannot be accepted — create a revision.");
  if (q.status !== "SENT") throw new EnquiryError("CONFLICT", "A quotation can only be accepted once it has been approved and sent.");

  const now = new Date();
  await prisma.quotation.update({
    where: { id },
    data: {
      status: "ACCEPTED", acceptanceStatus: "ACCEPTED", acceptanceDate: now, acceptedById: actor.id,
      poNumber: input.poNumber ?? null, acceptanceNotes: input.notes ?? "", updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await setEnquiryStatus(actor, q.enquiryId, "ACCEPTED");
  await logAudit(actor.id, {
    action: "CUSTOMER_ACCEPTANCE_RECORDED", module: "quotations", entityType: "quotation", entityId: id,
    oldValue: { status: "SENT" }, newValue: { status: "ACCEPTED", manuallyConfirmedBy: actor.id, poNumber: input.poNumber ?? null },
  });
  return { ok: true as const };
}

export async function recordRejection(actor: Actor, id: string, reason: string) {
  assertQuotation(actor, "recordAcceptance");
  if (!reason.trim()) throw new EnquiryError("VALIDATION", "A reason is required.", { reason: "Required" });
  await refreshExpiry(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await prisma.quotation.findUnique({ where: { id } }) as any;
  if (!q) throw new EnquiryError("NOT_FOUND", "Quotation not found.");
  if (q.status !== "SENT") throw new EnquiryError("CONFLICT", "Only a sent quotation can be marked as customer-rejected.");

  const now = new Date();
  await prisma.quotation.update({ where: { id }, data: { status: "CUSTOMER_REJECTED", acceptanceStatus: "REJECTED", rejectionReason: reason, updatedAt: now } });
  await setEnquiryStatus(actor, q.enquiryId, "REJECTED");
  await logAudit(actor.id, { action: "CUSTOMER_REJECTION_RECORDED", module: "quotations", entityType: "quotation", entityId: id, oldValue: { status: "SENT" }, newValue: { status: "CUSTOMER_REJECTED", reason } });
  return { ok: true as const };
}

export { computeTotals };
