// Test Request Form (TRF) service layer — authoritative server-side logic
// for Module 3. Mirrors lib/customers/service.ts and lib/enquiries/service.ts:
// server actions call into this, never the other way around.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextTrfCode } from "@/lib/ids";
import { TrfError, canTrf, isClientScoped, type Actor } from "./access";
import {
  type TrfInput, type TrfSampleInput, type TrfTestRequestInput, type TrfAuthorizationInput, type TrfDocumentMeta,
  validateStep1, validateStep2, validateStep3, validateStep4, validateFullTrf, validateTrfDocumentMeta,
} from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canTrf>[1]) {
  if (!canTrf(actor, cap)) throw new TrfError("FORBIDDEN", "You do not have permission to perform this action.");
}

function scopeWhere(actor: Actor): Record<string, unknown> | null {
  if (isClientScoped(actor)) return { customerId: actor.clientId ?? "__none__" };
  return null;
}

const EDITABLE_STATUSES = ["DRAFT"];

async function loadTrf(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = await prisma.trf.findUnique({
    where: { id },
    include: { customer: true, quotation: true, samples: { include: { tests: true } }, documents: true, authorization: true, createdBy: true, submittedBy: true },
  }) as any;
  if (!t) throw new TrfError("NOT_FOUND", "TRF not found.");
  return t;
}

function assertEditable(t: { status: string }) {
  if (!EDITABLE_STATUSES.includes(t.status)) throw new TrfError("CONFLICT", `Cannot modify a TRF in ${t.status} status.`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTrf(actor: Actor, id: string) {
  assert(actor, "view");
  const t = await loadTrf(id);
  const scope = scopeWhere(actor);
  if (scope && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  return t;
}

export interface TrfListParams {
  search?: string; status?: string; customerId?: string; priority?: string; quotationId?: string; createdById?: string;
  dateFrom?: string; dateTo?: string; sortBy?: "trfCode" | "createdAt" | "requestedDueDate" | "status"; sortDir?: "asc" | "desc";
  page?: number; pageSize?: number;
}

export async function listTrfs(actor: Actor, params: TrfListParams) {
  assert(actor, "view");
  const scope = scopeWhere(actor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.trf.findMany({
    where: scope ?? undefined,
    include: { customer: true, quotation: true, samples: { include: { tests: true } }, createdBy: true },
  });

  const q = params.search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((t) =>
      [t.trfCode, t.customer?.name, t.customer?.code, t.quotation?.quotationCode, ...t.samples.map((s: { sampleName: string; customerSampleRef?: string }) => s.sampleName), ...t.samples.map((s: { customerSampleRef?: string }) => s.customerSampleRef)]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q)));
  }
  if (params.status) rows = rows.filter((t) => t.status === params.status);
  if (params.customerId) rows = rows.filter((t) => t.customerId === params.customerId);
  if (params.priority) rows = rows.filter((t) => t.priority === params.priority);
  if (params.quotationId) rows = rows.filter((t) => t.quotationId === params.quotationId);
  if (params.createdById) rows = rows.filter((t) => t.createdById === params.createdById);
  if (params.dateFrom) rows = rows.filter((t) => t.createdAt >= new Date(params.dateFrom!));
  if (params.dateTo) rows = rows.filter((t) => t.createdAt <= new Date(params.dateTo! + "T23:59:59"));

  const sortBy = params.sortBy ?? "createdAt";
  const dir = params.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[sortBy]; const bv = b[sortBy];
    if (av instanceof Date && bv instanceof Date) return dir * (av.getTime() - bv.getTime());
    return dir * String(av ?? "").localeCompare(String(bv ?? ""));
  });

  const total = rows.length;
  const pageSize = params.pageSize ?? 10;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      draft: rows.filter((t) => t.status === "DRAFT").length,
      submitted: rows.filter((t) => t.status === "SUBMITTED").length,
      underReview: rows.filter((t) => t.status === "UNDER_REVIEW").length,
      accepted: rows.filter((t) => t.status === "ACCEPTED").length,
      onHold: rows.filter((t) => t.status === "ON_HOLD").length,
      rejected: rows.filter((t) => t.status === "REJECTED").length,
    },
  };
}

/** Accepted quotations for a customer that don't already have an active (non-rejected) TRF. */
export async function getEligibleQuotations(customerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quotations, trfs] = await Promise.all([
    prisma.quotation.findMany({ where: { customerId, status: "ACCEPTED" } }) as unknown as Promise<any[]>,
    prisma.trf.findMany({ where: { customerId } }) as unknown as Promise<any[]>,
  ]);
  const consumedQuotationIds = new Set(trfs.filter((t) => t.status !== "REJECTED").map((t) => t.quotationId));
  return quotations.filter((q) => !consumedQuotationIds.has(q.id));
}

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

async function assertCustomerUsable(customerId: string, actor: Actor) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = await prisma.client.findUnique({ where: { id: customerId } }) as any;
  if (!customer) throw new TrfError("VALIDATION", "Select a valid customer.", { customerId: "Customer not found." });
  if (!customer.isActive) throw new TrfError("VALIDATION", "Inactive customers cannot submit a new TRF.", { customerId: "This customer is inactive." });
  if (isClientScoped(actor) && customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "You can only create a TRF for your own organization.");
  return customer;
}

async function assertQuotationUsable(quotationId: string, customerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } }) as any;
  if (!quotation) throw new TrfError("VALIDATION", "Select a valid quotation.", { quotationId: "Quotation not found." });
  if (quotation.customerId !== customerId) throw new TrfError("VALIDATION", "The selected quotation does not belong to this customer.", { quotationId: "Quotation/customer mismatch." });
  if (quotation.status !== "ACCEPTED") throw new TrfError("VALIDATION", "Only an accepted quotation can be used to create a TRF.", { quotationId: "This quotation has not been accepted." });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.trf.findMany({ where: { quotationId } }) as any[];
  if (existing.some((t) => t.status !== "REJECTED")) {
    throw new TrfError("CONFLICT", "A TRF already exists for this accepted quotation.", { quotationId: "Duplicate TRF for this quotation." });
  }
  return quotation;
}

export async function createTrfDraft(actor: Actor, input: Pick<TrfInput, "customerId" | "quotationId" | "poNumber">) {
  assert(actor, "create");
  const errors = validateStep1(input);
  if (Object.keys(errors).length) throw new TrfError("VALIDATION", "Please select a customer and an accepted quotation.", errors);

  await assertCustomerUsable(input.customerId, actor);
  const quotation = await assertQuotationUsable(input.quotationId, input.customerId);

  const now = new Date();
  const created = await prisma.trf.create({
    data: {
      trfCode: null, customerId: input.customerId, quotationId: input.quotationId,
      quotationRevisionSnapshot: quotation.revisionNumber, poNumber: input.poNumber ?? quotation.poNumber ?? "",
      acceptedChargesSnapshot: quotation.grandTotal, paymentTermsSnapshot: quotation.paymentTerms,
      status: "DRAFT", priority: "Normal", requestedDueDate: null, agreedTurnaroundDays: null,
      specialDeadlineInstructions: "", storageCondition: "Ambient", storageTemperature: "",
      specialHandlingInstructions: "", lightSensitive: false, moistureSensitive: false, otherStorageNotes: "",
      reportRecipient: "", reportEmail: "", reportingUnits: "", reportLanguage: "English",
      conformityStatementRequested: false, applicableSpecification: "", reportingInstructions: "",
      submittedAt: null, submittedById: null, holdReason: null, rejectionReason: null, clarificationComments: null,
      receiptStatus: "PENDING", receiptConfirmedAt: null, receiptConfirmedById: null,
      createdById: actor.id, updatedById: actor.id, createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await prisma.trfAuthorization.create({
    data: { trfId: created.id, status: "NOT_AUTHORIZED", authorizedPersonName: "", authorizedPersonDesignation: "", authorizationDate: null, authorizationMethod: "", signedTrfDocumentId: null, notes: "", createdAt: now, updatedAt: now },
  });

  await logAudit(actor.id, { action: "TRF_CREATED", module: "trfs", entityType: "trf", entityId: created.id, oldValue: null, newValue: { customerId: input.customerId, quotationId: input.quotationId } });
  return { ok: true as const, id: created.id };
}

export interface TrfStep4Fields {
  poNumber?: string; priority: string; requestedDueDate: string; agreedTurnaroundDays?: number; specialDeadlineInstructions?: string;
  storageCondition: string; storageTemperature?: string; specialHandlingInstructions?: string; lightSensitive?: boolean;
  moistureSensitive?: boolean; otherStorageNotes?: string; reportRecipient?: string; reportEmail?: string; reportingUnits?: string;
  reportLanguage?: string; conformityStatementRequested: boolean; applicableSpecification?: string; reportingInstructions?: string;
}

export async function updateTrfDraft(actor: Actor, id: string, fields: TrfStep4Fields) {
  assert(actor, "edit");
  const t = await loadTrf(id);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);

  const errors = validateStep4({ ...fields, customerId: t.customerId, quotationId: t.quotationId, samples: [], authorization: { status: "NOT_AUTHORIZED" } });
  if (Object.keys(errors).length) throw new TrfError("VALIDATION", "Please fix the highlighted fields.", errors);

  const oldSnapshot = { priority: t.priority, requestedDueDate: t.requestedDueDate, storageCondition: t.storageCondition };
  await prisma.trf.update({
    where: { id },
    data: {
      poNumber: fields.poNumber ?? t.poNumber, priority: fields.priority, requestedDueDate: new Date(fields.requestedDueDate),
      agreedTurnaroundDays: fields.agreedTurnaroundDays ?? null, specialDeadlineInstructions: fields.specialDeadlineInstructions ?? "",
      storageCondition: fields.storageCondition, storageTemperature: fields.storageTemperature ?? "",
      specialHandlingInstructions: fields.specialHandlingInstructions ?? "", lightSensitive: !!fields.lightSensitive,
      moistureSensitive: !!fields.moistureSensitive, otherStorageNotes: fields.otherStorageNotes ?? "",
      reportRecipient: fields.reportRecipient ?? "", reportEmail: fields.reportEmail ?? "", reportingUnits: fields.reportingUnits ?? "",
      reportLanguage: fields.reportLanguage ?? "English", conformityStatementRequested: !!fields.conformityStatementRequested,
      applicableSpecification: fields.applicableSpecification ?? "", reportingInstructions: fields.reportingInstructions ?? "",
      updatedById: actor.id, updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actor.id, { action: "TRF_UPDATED", module: "trfs", entityType: "trf", entityId: id, oldValue: oldSnapshot, newValue: fields });
  return { ok: true as const, id };
}

// ---- Samples ----

export async function addTrfSample(actor: Actor, trfId: string, input: TrfSampleInput) {
  assert(actor, "edit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);
  const errors = { ...validateStep2([input]), ...validateStep3([input]) };
  if (Object.keys(errors).length) throw new TrfError("VALIDATION", "Please fix the highlighted fields.", errors);

  const now = new Date();
  const sample = await prisma.trfSample.create({
    data: {
      trfId, sampleName: input.sampleName, productCategory: input.productCategory, brandName: input.brandName ?? "",
      batchNumber: input.batchNumber ?? "", customerSampleRef: input.customerSampleRef ?? "", quantity: input.quantity,
      quantityUnit: input.quantityUnit, containers: input.containers, packagingType: input.packagingType ?? "",
      manufacturer: input.manufacturer ?? "", manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, declaredComposition: input.declaredComposition ?? "",
      labelClaim: input.labelClaim ?? "", productDescription: input.productDescription ?? "", sampledBy: input.sampledBy,
      samplingDate: input.samplingDate ? new Date(input.samplingDate) : null, samplingLocation: input.samplingLocation ?? "",
      samplingProcedure: input.samplingProcedure ?? "", createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  for (const test of input.tests) {
    await createTestRequestRow(sample.id, test, now);
  }
  await logAudit(actor.id, { action: "TRF_SAMPLE_ADDED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: null, newValue: { sampleId: sample.id, sampleName: input.sampleName } });
  return { ok: true as const, id: sample.id };
}

async function createTestRequestRow(trfSampleId: string, t: TrfTestRequestInput, now: Date) {
  return prisma.trfTestRequest.create({
    data: {
      trfSampleId, serviceId: t.customRequest ? null : t.serviceId, customRequest: t.customRequest,
      customServiceName: t.customRequest ? (t.customServiceName ?? "") : null, requestedParameter: t.requestedParameter,
      preferredMethod: t.preferredMethod ?? "", specification: t.specification ?? "", testingPurpose: t.testingPurpose ?? "",
      requiredQuantity: t.requiredQuantity ?? "", customerRequirements: t.customerRequirements ?? "",
      subcontractingPreference: t.subcontractingPreference ?? "", createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
}

export async function updateTrfSample(actor: Actor, trfId: string, sampleId: string, input: TrfSampleInput) {
  assert(actor, "edit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.trfSample.findUnique({ where: { id: sampleId } }) as any;
  if (!existing || existing.trfId !== trfId) throw new TrfError("NOT_FOUND", "Sample not found on this TRF.");
  const errors = { ...validateStep2([input]), ...validateStep3([input]) };
  if (Object.keys(errors).length) throw new TrfError("VALIDATION", "Please fix the highlighted fields.", errors);

  const now = new Date();
  await prisma.trfSample.update({
    where: { id: sampleId },
    data: {
      sampleName: input.sampleName, productCategory: input.productCategory, brandName: input.brandName ?? "",
      batchNumber: input.batchNumber ?? "", customerSampleRef: input.customerSampleRef ?? "", quantity: input.quantity,
      quantityUnit: input.quantityUnit, containers: input.containers, packagingType: input.packagingType ?? "",
      manufacturer: input.manufacturer ?? "", manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, declaredComposition: input.declaredComposition ?? "",
      labelClaim: input.labelClaim ?? "", productDescription: input.productDescription ?? "", sampledBy: input.sampledBy,
      samplingDate: input.samplingDate ? new Date(input.samplingDate) : null, samplingLocation: input.samplingLocation ?? "",
      samplingProcedure: input.samplingProcedure ?? "", updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await prisma.trfTestRequest.deleteMany({ where: { trfSampleId: sampleId } });
  for (const test of input.tests) await createTestRequestRow(sampleId, test, now);

  await logAudit(actor.id, { action: "TRF_SAMPLE_UPDATED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { sampleId, sampleName: existing.sampleName }, newValue: { sampleName: input.sampleName } });
  return { ok: true as const, id: sampleId };
}

export async function removeTrfSample(actor: Actor, trfId: string, sampleId: string) {
  assert(actor, "edit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.trfSample.findUnique({ where: { id: sampleId } }) as any;
  if (!existing || existing.trfId !== trfId) throw new TrfError("NOT_FOUND", "Sample not found on this TRF.");

  await prisma.trfTestRequest.deleteMany({ where: { trfSampleId: sampleId } });
  await prisma.trfSample.delete({ where: { id: sampleId } });
  await logAudit(actor.id, { action: "TRF_SAMPLE_REMOVED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { sampleId, sampleName: existing.sampleName }, newValue: null });
  return { ok: true as const };
}

// ---- Documents ----

export async function addTrfDocument(actor: Actor, trfId: string, meta: TrfDocumentMeta) {
  assert(actor, "edit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);
  const errors = validateTrfDocumentMeta(meta);
  if (Object.keys(errors).length) throw new TrfError("VALIDATION", "Invalid document.", errors);

  // Note: no real storage backend is wired up (mock/in-memory data layer only)
  // — only the metadata + audit trail is persisted, not file bytes.
  const created = await prisma.trfDocument.create({
    data: { trfId, docType: meta.docType, fileName: meta.fileName, sizeBytes: meta.sizeBytes, mimeType: meta.mimeType, uploadedById: actor.id, uploadedAt: new Date() },
  });
  if (meta.docType === "Signed TRF") {
    await prisma.trfAuthorization.updateMany({ where: { trfId }, data: { signedTrfDocumentId: created.id } });
  }
  await logAudit(actor.id, { action: "TRF_DOCUMENT_ADDED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: null, newValue: { fileName: meta.fileName, docType: meta.docType } });
  return { ok: true as const, id: created.id };
}

export async function removeTrfDocument(actor: Actor, trfId: string, documentId: string) {
  assert(actor, "edit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await prisma.trfDocument.findUnique({ where: { id: documentId } }) as any;
  if (!doc || doc.trfId !== trfId) throw new TrfError("NOT_FOUND", "Document not found on this TRF.");
  await prisma.trfDocument.delete({ where: { id: documentId } });
  await logAudit(actor.id, { action: "TRF_DOCUMENT_REMOVED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { fileName: doc.fileName }, newValue: null });
  return { ok: true as const };
}

// ---- Authorization ----

export async function setTrfAuthorization(actor: Actor, trfId: string, input: TrfAuthorizationInput) {
  assert(actor, "edit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  assertEditable(t);

  const now = new Date();
  const existing = t.authorization;
  const data = {
    status: input.status, authorizedPersonName: input.authorizedPersonName ?? "", authorizedPersonDesignation: input.authorizedPersonDesignation ?? "",
    authorizationDate: input.authorizationDate ? new Date(input.authorizationDate) : (input.status === "AUTHORIZED" ? now : null),
    authorizationMethod: input.authorizationMethod ?? "", notes: input.notes ?? "", updatedAt: now,
  };
  if (existing) {
    await prisma.trfAuthorization.update({ where: { id: existing.id }, data });
  } else {
    await prisma.trfAuthorization.create({ data: { trfId, signedTrfDocumentId: null, createdAt: now, ...data } });
  }
  await logAudit(actor.id, { action: "TRF_AUTHORIZATION_UPDATED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: existing ? { status: existing.status } : null, newValue: { status: input.status, authorizedPersonName: input.authorizedPersonName } });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Submission & review workflow
// ---------------------------------------------------------------------------

async function recordHistory(trfId: string, actorId: string | null, action: string, fromStatus: string, toStatus: string, comment?: string | null) {
  await prisma.trfReviewHistory.create({ data: { trfId, action, actorId, comment: comment ?? null, fromStatus, toStatus, createdAt: new Date() } });
}

export async function submitTrf(actor: Actor, trfId: string) {
  assert(actor, "submit");
  const t = await loadTrf(trfId);
  if (isClientScoped(actor) && t.customerId !== actor.clientId) throw new TrfError("FORBIDDEN", "Not your organization's TRF.");
  if (t.status !== "DRAFT") throw new TrfError("CONFLICT", "Only a draft TRF can be submitted.");

  const hasSignedTrf = (t.documents as { docType: string }[]).some((d) => d.docType === "Signed TRF");
  const fullInput: TrfInput = {
    customerId: t.customerId, quotationId: t.quotationId, poNumber: t.poNumber, priority: t.priority,
    requestedDueDate: t.requestedDueDate ? new Date(t.requestedDueDate).toISOString().slice(0, 10) : "",
    agreedTurnaroundDays: t.agreedTurnaroundDays ?? undefined, specialDeadlineInstructions: t.specialDeadlineInstructions,
    storageCondition: t.storageCondition, storageTemperature: t.storageTemperature, specialHandlingInstructions: t.specialHandlingInstructions,
    lightSensitive: t.lightSensitive, moistureSensitive: t.moistureSensitive, otherStorageNotes: t.otherStorageNotes,
    reportRecipient: t.reportRecipient, reportEmail: t.reportEmail, reportingUnits: t.reportingUnits, reportLanguage: t.reportLanguage,
    conformityStatementRequested: t.conformityStatementRequested, applicableSpecification: t.applicableSpecification,
    reportingInstructions: t.reportingInstructions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    samples: (t.samples as any[]).map((s) => ({
      sampleName: s.sampleName, productCategory: s.productCategory, quantity: s.quantity, quantityUnit: s.quantityUnit,
      containers: s.containers, sampledBy: s.sampledBy, manufacturingDate: s.manufacturingDate, expiryDate: s.expiryDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tests: (s.tests as any[]).map((test) => ({ serviceId: test.serviceId ?? "", customRequest: test.customRequest, customServiceName: test.customServiceName, requestedParameter: test.requestedParameter })),
    })),
    authorization: t.authorization ? { status: t.authorization.status, authorizedPersonName: t.authorization.authorizedPersonName, authorizationMethod: t.authorization.authorizationMethod } : { status: "NOT_AUTHORIZED" },
  };
  const errors = validateFullTrf(fullInput, hasSignedTrf);
  if (Object.keys(errors).length) throw new TrfError("VALIDATION", "This TRF is not ready to submit — please complete all required fields.", errors);

  const count = await prisma.trf.count({});
  const code = nextTrfCode(count + 1);
  const now = new Date();
  await prisma.trf.update({ where: { id: trfId }, data: { trfCode: code, status: "SUBMITTED", submittedAt: now, submittedById: actor.id, updatedAt: now } });
  await recordHistory(trfId, actor.id, "SUBMITTED", "DRAFT", "SUBMITTED");
  await logAudit(actor.id, { action: "TRF_SUBMITTED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { status: "DRAFT" }, newValue: { status: "SUBMITTED", trfCode: code } });
  return { ok: true as const, id: trfId, code };
}

export async function startTrfReview(actor: Actor, trfId: string) {
  assert(actor, "review");
  const t = await loadTrf(trfId);
  if (t.status !== "SUBMITTED") throw new TrfError("CONFLICT", "Only a submitted TRF can enter technical review.");
  await prisma.trf.update({ where: { id: trfId }, data: { status: "UNDER_REVIEW", updatedAt: new Date() } });
  await recordHistory(trfId, actor.id, "REVIEW_STARTED", "SUBMITTED", "UNDER_REVIEW");
  await logAudit(actor.id, { action: "TRF_REVIEW_STARTED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { status: "SUBMITTED" }, newValue: { status: "UNDER_REVIEW" } });
  return { ok: true as const };
}

export async function acceptTrf(actor: Actor, trfId: string) {
  assert(actor, "review");
  const t = await loadTrf(trfId);
  if (t.status !== "UNDER_REVIEW") throw new TrfError("CONFLICT", "Only a TRF under technical review can be accepted.");
  await prisma.trf.update({ where: { id: trfId }, data: { status: "ACCEPTED", updatedAt: new Date() } });
  await recordHistory(trfId, actor.id, "ACCEPTED", "UNDER_REVIEW", "ACCEPTED");
  await logAudit(actor.id, { action: "TRF_ACCEPTED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { status: "UNDER_REVIEW" }, newValue: { status: "ACCEPTED" } });
  return { ok: true as const };
}

export async function holdTrf(actor: Actor, trfId: string, reason: string) {
  assert(actor, "review");
  if (!reason.trim()) throw new TrfError("VALIDATION", "A reason is required to place a TRF on hold.", { reason: "Required" });
  const t = await loadTrf(trfId);
  if (t.status !== "UNDER_REVIEW") throw new TrfError("CONFLICT", "Only a TRF under technical review can be placed on hold.");
  await prisma.trf.update({ where: { id: trfId }, data: { status: "ON_HOLD", holdReason: reason, updatedAt: new Date() } });
  await recordHistory(trfId, actor.id, "ON_HOLD", "UNDER_REVIEW", "ON_HOLD", reason);
  await logAudit(actor.id, { action: "TRF_ON_HOLD", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { status: "UNDER_REVIEW" }, newValue: { status: "ON_HOLD", reason } });
  return { ok: true as const };
}

export async function resumeTrfReview(actor: Actor, trfId: string) {
  assert(actor, "review");
  const t = await loadTrf(trfId);
  if (t.status !== "ON_HOLD") throw new TrfError("CONFLICT", "Only a TRF on hold can resume review.");
  await prisma.trf.update({ where: { id: trfId }, data: { status: "UNDER_REVIEW", holdReason: null, updatedAt: new Date() } });
  await recordHistory(trfId, actor.id, "REVIEW_RESUMED", "ON_HOLD", "UNDER_REVIEW");
  await logAudit(actor.id, { action: "TRF_REVIEW_RESUMED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { status: "ON_HOLD" }, newValue: { status: "UNDER_REVIEW" } });
  return { ok: true as const };
}

export async function rejectTrf(actor: Actor, trfId: string, reason: string) {
  assert(actor, "review");
  if (!reason.trim()) throw new TrfError("VALIDATION", "A reason is required to reject a TRF.", { reason: "Required" });
  const t = await loadTrf(trfId);
  if (!["SUBMITTED", "UNDER_REVIEW", "ON_HOLD"].includes(t.status)) throw new TrfError("CONFLICT", `Cannot reject a TRF in ${t.status} status.`);
  await prisma.trf.update({ where: { id: trfId }, data: { status: "REJECTED", rejectionReason: reason, updatedAt: new Date() } });
  await recordHistory(trfId, actor.id, "REJECTED", t.status, "REJECTED", reason);
  await logAudit(actor.id, { action: "TRF_REJECTED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: { status: t.status }, newValue: { status: "REJECTED", reason } });
  return { ok: true as const };
}

export async function requestTrfClarification(actor: Actor, trfId: string, comment: string) {
  assert(actor, "review");
  if (!comment.trim()) throw new TrfError("VALIDATION", "A comment is required to request clarification.", { comment: "Required" });
  const t = await loadTrf(trfId);
  if (t.status !== "UNDER_REVIEW") throw new TrfError("CONFLICT", "Clarification can only be requested while a TRF is under technical review.");
  await prisma.trf.update({ where: { id: trfId }, data: { clarificationComments: comment, updatedAt: new Date() } });
  await recordHistory(trfId, actor.id, "CLARIFICATION_REQUESTED", "UNDER_REVIEW", "UNDER_REVIEW", comment);
  await logAudit(actor.id, { action: "TRF_CLARIFICATION_REQUESTED", module: "trfs", entityType: "trf", entityId: trfId, oldValue: null, newValue: { comment } });
  return { ok: true as const };
}

export async function getTrfHistory(actor: Actor, trfId: string) {
  assert(actor, "history");
  return prisma.trfReviewHistory.findMany({ where: { trfId }, include: { actor: true } });
}
