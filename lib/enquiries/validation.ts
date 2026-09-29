// Enquiry & Quotation validation — pure functions, mirrors the pattern in
// lib/customers/validation.ts. Authoritative enforcement happens in
// lib/enquiries/service.ts; this module only shapes/validates the input.

export const ENQUIRY_SOURCES = ["Email", "Phone", "Website", "Walk-in", "Existing Customer", "Other"] as const;
export const ENQUIRY_PRIORITIES = ["Normal", "High", "Urgent"] as const;

export const ENQUIRY_STATUSES = [
  "DRAFT", "NEW", "UNDER_REVIEW", "QUOTATION_IN_PROGRESS", "QUOTATION_SENT", "ACCEPTED", "REJECTED", "CLOSED",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  DRAFT: "Draft",
  NEW: "New",
  UNDER_REVIEW: "Under Review",
  QUOTATION_IN_PROGRESS: "Quotation In Progress",
  QUOTATION_SENT: "Quotation Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export interface EnquiryTestRequestInput {
  serviceId: string; // catalog id, or "" for a custom request
  customRequest: boolean;
  customServiceName?: string;
  requestedTest: string;
  requestedMethod?: string;
  specification?: string;
  requestedQuantity: number;
  specialRequirements?: string;
  estimatedTurnaroundDays?: number;
}

export interface EnquiryProductInput {
  productName: string;
  productCategory: string;
  productDescription?: string;
  batchNumber?: string;
  sampleType?: string;
  sampleMatrix?: string;
  quantity?: number;
  quantityUnit?: string;
  packagingDetails?: string;
  storageRequirements?: string;
  specialHandlingInstructions?: string;
  requestedTestingDate?: string;
  notes?: string;
  tests: EnquiryTestRequestInput[];
}

export interface EnquiryInput {
  customerId: string;
  contactOverrideId?: string; // optional: a different customerContact for this enquiry
  enquiryDate: string;
  enquirySource: string;
  assignedManagerId: string;
  priority: string;
  requestedTurnaroundDays: number;
  purposeOfTesting?: string;
  regulatoryRequirements?: string;
  requiredReportingFormat?: string;
  requiredAccreditation?: string;
  reportDeliveryMethod?: string;
  customerNotes?: string;
  products: EnquiryProductInput[];
}

export type FieldErrors = Record<string, string>;

export function emptyTestRequest(): EnquiryTestRequestInput {
  return { serviceId: "", customRequest: false, requestedTest: "", requestedQuantity: 1 };
}

export function emptyProduct(): EnquiryProductInput {
  return { productName: "", productCategory: "", tests: [emptyTestRequest()] };
}

export function emptyEnquiryInput(): EnquiryInput {
  return {
    customerId: "",
    enquiryDate: new Date().toISOString().slice(0, 10),
    enquirySource: ENQUIRY_SOURCES[0],
    assignedManagerId: "",
    priority: "Normal",
    requestedTurnaroundDays: 5,
    products: [emptyProduct()],
  };
}

export function validateEnquiry(input: EnquiryInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.customerId) e.customerId = "Select a customer.";
  if (!input.enquiryDate) e.enquiryDate = "Enquiry date is required.";
  if (!(ENQUIRY_SOURCES as readonly string[]).includes(input.enquirySource)) e.enquirySource = "Select an enquiry source.";
  if (!(ENQUIRY_PRIORITIES as readonly string[]).includes(input.priority)) e.priority = "Select a priority.";
  if (!input.assignedManagerId) e.assignedManagerId = "Assign a manager.";
  if (!input.requestedTurnaroundDays || input.requestedTurnaroundDays <= 0) e.requestedTurnaroundDays = "Enter a valid turnaround time (days).";

  if (!input.products.length) e.products = "Add at least one product or sample.";
  input.products.forEach((p, pi) => {
    if (!p.productName.trim()) e[`products.${pi}.productName`] = "Product name is required.";
    if (!p.productCategory.trim()) e[`products.${pi}.productCategory`] = "Product category is required.";
    if (p.quantity !== undefined && p.quantity < 0) e[`products.${pi}.quantity`] = "Quantity cannot be negative.";
    if (!p.tests.length) e[`products.${pi}.tests`] = "Add at least one requested testing service for this product.";
    p.tests.forEach((t, ti) => {
      if (t.customRequest) {
        if (!t.customServiceName?.trim()) e[`products.${pi}.tests.${ti}.customServiceName`] = "Name the custom service being requested.";
      } else if (!t.serviceId) {
        e[`products.${pi}.tests.${ti}.serviceId`] = "Select a testing service.";
      }
      if (!t.requestedTest.trim()) e[`products.${pi}.tests.${ti}.requestedTest`] = "Requested test / parameter is required.";
      if (!t.requestedQuantity || t.requestedQuantity <= 0) e[`products.${pi}.tests.${ti}.requestedQuantity`] = "Number of tests must be a positive value.";
    });
  });

  return e;
}

// ---- Quotations ----

export const QUOTATION_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "ACCEPTED", "CUSTOMER_REJECTED", "EXPIRED", "SUPERSEDED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  CUSTOMER_REJECTED: "Customer Rejected",
  EXPIRED: "Expired",
  SUPERSEDED: "Superseded",
};

export const ACCEPTANCE_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
export type AcceptanceStatus = (typeof ACCEPTANCE_STATUSES)[number];

export const TAX_CATEGORIES = ["Not Applicable", "Pending Configuration", "GST 18%", "GST 12%", "GST 5%", "GST 0%"] as const;

export function taxRateFor(category: string): number | null {
  const m = category.match(/GST (\d+(\.\d+)?)%/);
  return m ? Number(m[1]) : null;
}

export interface QuotationItemInput {
  testRequestId?: string; // link back to the originating enquiry_test_request, when not custom
  productReference: string;
  serviceName: string;
  method?: string;
  quantity: number;
  unitPrice: number;
  discount: number; // absolute amount, per line
  taxCategory: string;
  estimatedTurnaroundDays?: number;
}

export interface QuotationDraftInput {
  validUntil: string;
  paymentTerms?: string;
  advancePaymentRequired?: boolean;
  poRequired?: boolean;
  billingNotes?: string;
  discountTotal: number; // additional overall discount, beyond line discounts
  items: QuotationItemInput[];
}

export function validateQuotationDraft(input: QuotationDraftInput, quotationDate: Date): FieldErrors {
  const e: FieldErrors = {};
  if (!input.validUntil) e.validUntil = "Validity date is required.";
  else if (new Date(input.validUntil) < new Date(quotationDate.toDateString())) e.validUntil = "Validity date cannot precede the quotation date.";
  if (!input.items.length) e.items = "Add at least one line item.";
  if (input.discountTotal < 0) e.discountTotal = "Discount cannot be negative.";

  let subtotal = 0;
  input.items.forEach((it, i) => {
    if (!it.serviceName.trim()) e[`items.${i}.serviceName`] = "Service name is required.";
    if (it.quantity <= 0) e[`items.${i}.quantity`] = "Quantity must be a positive value.";
    if (it.unitPrice < 0) e[`items.${i}.unitPrice`] = "Unit price cannot be negative.";
    if (it.discount < 0) e[`items.${i}.discount`] = "Discount cannot be negative.";
    const lineSubtotal = it.quantity * it.unitPrice;
    if (it.discount > lineSubtotal) e[`items.${i}.discount`] = "Discount cannot exceed the line subtotal.";
    subtotal += Math.max(0, lineSubtotal - it.discount);
  });
  if (input.discountTotal > subtotal) e.discountTotal = "Discount cannot exceed the subtotal.";

  return e;
}
