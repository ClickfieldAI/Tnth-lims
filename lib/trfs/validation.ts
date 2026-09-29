// Test Request Form (TRF) validation — mirrors lib/customers/validation.ts and
// lib/enquiries/validation.ts. Pure functions; authoritative enforcement is
// in lib/trfs/service.ts.

export const TRF_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "ON_HOLD", "REJECTED"] as const;
export type TrfStatus = (typeof TRF_STATUSES)[number];

export const TRF_STATUS_LABEL: Record<TrfStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  ON_HOLD: "On Hold",
  REJECTED: "Rejected",
};

export const TRF_PRIORITIES = ["Normal", "High", "Rush"] as const;
export const SAMPLED_BY = ["Customer", "TNTH"] as const;
export const STORAGE_CONDITIONS = ["Ambient", "Refrigerated", "Frozen", "Other"] as const;
export const AUTHORIZATION_METHODS = ["Signed TRF Upload", "Authorized Portal Submission", "Other"] as const;
export const TRF_DOC_TYPES = [
  "Signed TRF", "Accepted Quotation", "Purchase Order", "Product Label Image", "Product Specification", "Safety Data Sheet (SDS)", "Other Supporting Documents",
] as const;

export type FieldErrors = Record<string, string>;

export interface TrfTestRequestInput {
  serviceId: string;
  customRequest: boolean;
  customServiceName?: string;
  requestedParameter: string;
  preferredMethod?: string;
  specification?: string;
  testingPurpose?: string;
  requiredQuantity?: string;
  customerRequirements?: string;
  subcontractingPreference?: string;
}

export interface TrfSampleInput {
  sampleName: string;
  productCategory: string;
  brandName?: string;
  batchNumber?: string;
  customerSampleRef?: string;
  quantity: number;
  quantityUnit: string;
  containers: number;
  packagingType?: string;
  manufacturer?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  declaredComposition?: string;
  labelClaim?: string;
  productDescription?: string;
  sampledBy: string;
  samplingDate?: string;
  samplingLocation?: string;
  samplingProcedure?: string;
  tests: TrfTestRequestInput[];
}

export interface TrfAuthorizationInput {
  status: "NOT_AUTHORIZED" | "AUTHORIZED";
  authorizedPersonName?: string;
  authorizedPersonDesignation?: string;
  authorizationDate?: string;
  authorizationMethod?: string;
  notes?: string;
}

export interface TrfInput {
  customerId: string;
  quotationId: string;
  poNumber?: string;
  priority: string;
  requestedDueDate: string;
  agreedTurnaroundDays?: number;
  specialDeadlineInstructions?: string;
  storageCondition: string;
  storageTemperature?: string;
  specialHandlingInstructions?: string;
  lightSensitive?: boolean;
  moistureSensitive?: boolean;
  otherStorageNotes?: string;
  reportRecipient?: string;
  reportEmail?: string;
  reportingUnits?: string;
  reportLanguage?: string;
  conformityStatementRequested: boolean;
  applicableSpecification?: string;
  reportingInstructions?: string;
  samples: TrfSampleInput[];
  authorization: TrfAuthorizationInput;
}

export const emptyTestRequest = (): TrfTestRequestInput => ({ serviceId: "", customRequest: false, requestedParameter: "" });
export const emptySample = (): TrfSampleInput => ({
  sampleName: "", productCategory: "", quantity: 1, quantityUnit: "", containers: 1, sampledBy: "Customer", tests: [emptyTestRequest()],
});
export const emptyAuthorization = (): TrfAuthorizationInput => ({ status: "NOT_AUTHORIZED" });

export const emptyTrfInput = (): TrfInput => ({
  customerId: "", quotationId: "", priority: "Normal", requestedDueDate: "",
  storageCondition: "Ambient", conformityStatementRequested: false,
  samples: [emptySample()], authorization: emptyAuthorization(),
});

// ---- Step validators (each returns only the errors relevant to that step) ----

export function validateStep1(input: Pick<TrfInput, "customerId" | "quotationId">): FieldErrors {
  const e: FieldErrors = {};
  if (!input.customerId) e.customerId = "Select a customer.";
  if (!input.quotationId) e.quotationId = "Select an accepted quotation for this customer.";
  return e;
}

export function validateStep2(samples: TrfSampleInput[]): FieldErrors {
  const e: FieldErrors = {};
  if (!samples.length) { e.samples = "Add at least one sample."; return e; }
  samples.forEach((s, i) => {
    if (!s.sampleName.trim()) e[`samples.${i}.sampleName`] = "Sample name is required.";
    if (!s.productCategory.trim()) e[`samples.${i}.productCategory`] = "Product category is required.";
    if (!s.quantity || s.quantity <= 0) e[`samples.${i}.quantity`] = "Sample quantity must be a positive value.";
    if (!s.quantityUnit.trim()) e[`samples.${i}.quantityUnit`] = "Quantity unit is required.";
    if (!s.containers || s.containers <= 0) e[`samples.${i}.containers`] = "Number of containers must be a positive value.";
    if (!(SAMPLED_BY as readonly string[]).includes(s.sampledBy)) e[`samples.${i}.sampledBy`] = "Select who sampled.";
    if (s.manufacturingDate && s.expiryDate && new Date(s.expiryDate) < new Date(s.manufacturingDate)) {
      e[`samples.${i}.expiryDate`] = "Expiry date cannot be before the manufacturing date.";
    }
  });
  return e;
}

export function validateStep3(samples: TrfSampleInput[]): FieldErrors {
  const e: FieldErrors = {};
  samples.forEach((s, i) => {
    if (!s.tests.length) { e[`samples.${i}.tests`] = "Add at least one requested test for this sample."; return; }
    s.tests.forEach((t, ti) => {
      if (t.customRequest) {
        if (!t.customServiceName?.trim()) e[`samples.${i}.tests.${ti}.customServiceName`] = "Name the custom service being requested.";
      } else if (!t.serviceId) {
        e[`samples.${i}.tests.${ti}.serviceId`] = "Select a testing service.";
      }
      if (!t.requestedParameter.trim()) e[`samples.${i}.tests.${ti}.requestedParameter`] = "Requested parameter is required.";
    });
  });
  return e;
}

export function validateStep4(input: TrfInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.requestedDueDate) e.requestedDueDate = "Requested due date is required.";
  else if (new Date(input.requestedDueDate) < new Date(new Date().toDateString())) e.requestedDueDate = "Requested due date cannot be in the past.";
  if (!(TRF_PRIORITIES as readonly string[]).includes(input.priority)) e.priority = "Select a priority.";
  if (!(STORAGE_CONDITIONS as readonly string[]).includes(input.storageCondition)) e.storageCondition = "Select a storage condition.";
  if (input.reportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.reportEmail)) e.reportEmail = "Enter a valid email address.";
  return e;
}

export interface TrfDocumentMeta { docType: string; fileName: string; sizeBytes: number; mimeType: string }
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const MAX_SIZE = 10 * 1024 * 1024;

export function validateTrfDocumentMeta(m: TrfDocumentMeta): FieldErrors {
  const e: FieldErrors = {};
  if (!m.docType) e.docType = "Select a document type.";
  if (!m.fileName) e.fileName = "File is required.";
  if (!ALLOWED_MIME.has(m.mimeType)) e.mimeType = "Only PDF, JPG, PNG or DOCX files are allowed.";
  if (m.sizeBytes > MAX_SIZE) e.sizeBytes = "File must be 10 MB or smaller.";
  return e;
}

/** Step 6 — authorization must be evidenced before submission. */
export function validateAuthorization(auth: TrfAuthorizationInput, hasSignedTrfDocument: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (auth.status !== "AUTHORIZED") { e.status = "Customer authorization is required before submission."; return e; }
  if (!auth.authorizedPersonName?.trim()) e.authorizedPersonName = "Authorized person's name is required.";
  if (!auth.authorizationMethod || !(AUTHORIZATION_METHODS as readonly string[]).includes(auth.authorizationMethod)) {
    e.authorizationMethod = "Select how authorization was obtained.";
  }
  if (auth.authorizationMethod === "Signed TRF Upload" && !hasSignedTrfDocument) {
    e.authorizationMethod = "Attach the signed TRF document before selecting this authorization method.";
  }
  return e;
}

export function validateFullTrf(input: TrfInput, hasSignedTrfDocument: boolean): FieldErrors {
  return {
    ...validateStep1(input),
    ...validateStep2(input.samples),
    ...validateStep3(input.samples),
    ...validateStep4(input),
    ...validateAuthorization(input.authorization, hasSignedTrfDocument),
  };
}
