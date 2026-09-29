// Customer Master service layer — the single place that talks to the data
// store for customers. Server actions (actions/customers.ts) call into this;
// it is the authoritative enforcement point for validation, normalization,
// duplicate detection and RBAC (never trust the UI to hide a button).
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { pad } from "@/lib/ids";
import { CustomerError, can, isScoped, type Actor } from "./access";
import {
  type CustomerInput, type FieldErrors, validateCustomer, normalizeInput, normalizeName,
} from "./validation";

export interface CustomerRow {
  id: string;
  code: string; // e.g. CUST-2026-00001
  customerType: string;
  name: string;
  tradeName: string;
  industry: string;
  isActive: boolean;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  alternatePhone: string;
  website: string;
  billing: Record<string, string>;
  reportingSameAsBilling: boolean;
  reporting: Record<string, string>;
  gstStatus: string;
  gstNumber: string;
  panNumber: string;
  billingTerms: string;
  poRequired: boolean;
  poReference: string;
  taxNotes: string;
  preferredComm: string;
  preferredDelivery: string;
  handlingInstructions: string;
  testingRequirements: string;
  reportingInstructions: string;
  notes: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

function assert(actor: Actor, cap: Parameters<typeof can>[1]) {
  if (!can(actor, cap)) throw new CustomerError("FORBIDDEN", "You do not have permission to perform this action.");
}

/** Client-role scoping: a client user may only ever see their own organization's record. */
function scopeWhere(actor: Actor): Record<string, unknown> | null {
  if (actor.role === "CLIENT") {
    if (!actor.clientId) return { id: "__none__" };
    return { id: actor.clientId };
  }
  // ANALYST/MICRO: read-only, but Customer Master itself isn't sample-scoped —
  // they can look up a customer for context on their assigned samples, never
  // edit. (Row-level "assigned samples only" scoping is enforced on the
  // samples module itself; here we just deny write caps via `can()`.)
  return null;
}

export interface ListParams {
  search?: string;
  type?: string;
  status?: "active" | "inactive" | "all";
  createdFrom?: string;
  createdTo?: string;
  sortBy?: "name" | "code" | "createdAt" | "customerType" | "status";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listCustomers(actor: Actor, params: ListParams) {
  assert(actor, "view");
  const scope = scopeWhere(actor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.client.findMany({ where: scope ?? undefined });

  const q = params.search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((c) =>
      [c.code, c.name, c.contactPerson, c.email, c.phone, c.gstNumber]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q)));
  }
  if (params.type && params.type !== "all") rows = rows.filter((c) => c.customerType === params.type);
  if (params.status === "active") rows = rows.filter((c) => c.isActive);
  if (params.status === "inactive") rows = rows.filter((c) => !c.isActive);
  if (params.createdFrom) rows = rows.filter((c) => c.createdAt >= new Date(params.createdFrom!));
  if (params.createdTo) rows = rows.filter((c) => c.createdAt <= new Date(params.createdTo! + "T23:59:59"));

  const sortBy = params.sortBy ?? "createdAt";
  const dir = params.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === "status") return dir * (Number(a.isActive) - Number(b.isActive));
    const av = a[sortBy === "customerType" ? "customerType" : sortBy];
    const bv = b[sortBy === "customerType" ? "customerType" : sortBy];
    if (av instanceof Date && bv instanceof Date) return dir * (av.getTime() - bv.getTime());
    return dir * String(av).localeCompare(String(bv));
  });

  const total = rows.length;
  const pageSize = params.pageSize ?? 10;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    rows: pageRows as CustomerRow[],
    total,
    page,
    pageSize,
    stats: {
      total: rows.length,
      active: rows.filter((c) => c.isActive).length,
      inactive: rows.filter((c) => !c.isActive).length,
      addedThisMonth: rows.filter((c) => c.createdAt >= monthStart).length,
    },
  };
}

export async function getCustomer(actor: Actor, id: string) {
  assert(actor, "view");
  const scope = scopeWhere(actor);
  if (scope && scope.id !== id && scope.id !== "__none__") throw new CustomerError("FORBIDDEN", "Not your organization's record.");
  if (scope?.id === "__none__") throw new CustomerError("FORBIDDEN", "No linked customer account.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await prisma.client.findUnique({ where: { id }, include: { contacts: true, documents: true } as any });
  if (!c) throw new CustomerError("NOT_FOUND", "Customer not found.");
  return c;
}

export interface DuplicateMatch { field: "name" | "gst" | "email"; id: string; code: string; name: string }

async function findDuplicates(input: CustomerInput, excludeId?: string): Promise<DuplicateMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = await prisma.client.findMany({});
  const matches: DuplicateMatch[] = [];
  const nName = normalizeName(input.name);
  const email = input.email.trim().toLowerCase();
  const gst = input.gstNumber.trim().toUpperCase();
  for (const c of all) {
    if (c.id === excludeId) continue;
    if (nName && c.normalizedName === nName) matches.push({ field: "name", id: c.id, code: c.code, name: c.name });
    else if (email && c.email && String(c.email).toLowerCase() === email) matches.push({ field: "email", id: c.id, code: c.code, name: c.name });
    else if (gst && c.gstNumber && String(c.gstNumber).toUpperCase() === gst) matches.push({ field: "gst", id: c.id, code: c.code, name: c.name });
  }
  return matches;
}

function nextCustomerCode(existing: number): string {
  return `CUST-${new Date().getFullYear()}-${pad(existing + 1, 5)}`;
}

export interface SaveResult {
  ok: true; id: string; code: string;
}

/** Throws CustomerError("DUPLICATE", ..., { matches }) unless `confirmDuplicate` is true. */
export async function createCustomer(actor: Actor, rawInput: CustomerInput, opts?: { confirmDuplicate?: boolean }): Promise<SaveResult> {
  assert(actor, "create");
  const input = normalizeInput(rawInput);
  const errors = validateCustomer(input);
  if (Object.keys(errors).length) throw new CustomerError("VALIDATION", "Please fix the highlighted fields.", errors);

  const dupes = await findDuplicates(input);
  if (dupes.length && !opts?.confirmDuplicate) {
    throw new CustomerError("DUPLICATE", "A similar customer record already exists.", { matches: dupes });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await prisma.client.count({});
  const code = nextCustomerCode(count);
  const now = new Date();
  const created = await prisma.client.create({
    data: {
      code, name: input.name, industry: input.industry, address: null,
      city: input.billing.city, country: input.billing.country,
      contactPerson: input.contactPerson, email: input.email, phone: input.phone,
      isActive: input.active,
      customerType: input.customerType, tradeName: input.tradeName, designation: input.designation,
      alternatePhone: input.alternatePhone, website: input.website,
      normalizedName: normalizeName(input.name),
      billing: input.billing, reportingSameAsBilling: input.reportingSameAsBilling, reporting: input.reporting,
      gstStatus: input.gstStatus, gstNumber: input.gstNumber, panNumber: input.panNumber,
      billingTerms: input.billingTerms, poRequired: input.poRequired, poReference: input.poReference, taxNotes: input.taxNotes,
      preferredComm: input.preferredComm, preferredDelivery: input.preferredDelivery,
      handlingInstructions: input.handlingInstructions, testingRequirements: input.testingRequirements,
      reportingInstructions: input.reportingInstructions, notes: input.notes,
      createdAt: now, updatedAt: now, createdById: actor.id, updatedById: actor.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  await logAudit(actor.id, {
    action: "CREATE", module: "customers", entityType: "client", entityId: created.id,
    oldValue: null, newValue: { code, name: input.name, customerType: input.customerType },
  });
  return { ok: true, id: created.id, code };
}

export async function updateCustomer(actor: Actor, id: string, rawInput: CustomerInput, opts?: { confirmDuplicate?: boolean }): Promise<SaveResult> {
  assert(actor, "edit");
  const scope = scopeWhere(actor);
  if (scope) throw new CustomerError("FORBIDDEN", "Client users cannot edit their own record.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.client.findUnique({ where: { id } }) as any;
  if (!existing) throw new CustomerError("NOT_FOUND", "Customer not found.");

  const input = normalizeInput(rawInput);
  const errors = validateCustomer(input);
  if (Object.keys(errors).length) throw new CustomerError("VALIDATION", "Please fix the highlighted fields.", errors);

  const dupes = await findDuplicates(input, id);
  if (dupes.length && !opts?.confirmDuplicate) {
    throw new CustomerError("DUPLICATE", "A similar customer record already exists.", { matches: dupes });
  }

  const oldSnapshot = { ...existing };
  await prisma.client.update({
    where: { id },
    data: {
      name: input.name, industry: input.industry,
      city: input.billing.city, country: input.billing.country,
      contactPerson: input.contactPerson, email: input.email, phone: input.phone,
      customerType: input.customerType, tradeName: input.tradeName, designation: input.designation,
      alternatePhone: input.alternatePhone, website: input.website,
      normalizedName: normalizeName(input.name),
      billing: input.billing, reportingSameAsBilling: input.reportingSameAsBilling, reporting: input.reporting,
      gstStatus: input.gstStatus, gstNumber: input.gstNumber, panNumber: input.panNumber,
      billingTerms: input.billingTerms, poRequired: input.poRequired, poReference: input.poReference, taxNotes: input.taxNotes,
      preferredComm: input.preferredComm, preferredDelivery: input.preferredDelivery,
      handlingInstructions: input.handlingInstructions, testingRequirements: input.testingRequirements,
      reportingInstructions: input.reportingInstructions, notes: input.notes,
      updatedAt: new Date(), updatedById: actor.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  await logAudit(actor.id, {
    action: "UPDATE", module: "customers", entityType: "client", entityId: id,
    oldValue: oldSnapshot, newValue: input,
  });
  return { ok: true, id, code: existing.code };
}

export async function setCustomerStatus(actor: Actor, id: string, active: boolean, reason?: string) {
  assert(actor, "status");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.client.findUnique({ where: { id } }) as any;
  if (!existing) throw new CustomerError("NOT_FOUND", "Customer not found.");
  if (existing.isActive === active) return { ok: true as const };

  await prisma.client.update({ where: { id }, data: { isActive: active, updatedAt: new Date(), updatedById: actor.id } });
  await logAudit(actor.id, {
    action: active ? "REACTIVATE" : "DEACTIVATE", module: "customers", entityType: "client", entityId: id,
    oldValue: { isActive: existing.isActive }, newValue: { isActive: active, reason: reason ?? null },
  });
  return { ok: true as const };
}

export async function getCustomerHistory(actor: Actor, id: string) {
  assert(actor, "history");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await prisma.auditLog.findMany({ where: { entityType: "client", entityId: id }, orderBy: { createdAt: "desc" }, include: { actor: true } as any });
  return logs;
}

export interface ContactInput { name: string; designation: string; email: string; phone: string; isPrimary: boolean }

export async function addContact(actor: Actor, customerId: string, input: ContactInput) {
  assert(actor, "edit");
  if (!input.name.trim()) throw new CustomerError("VALIDATION", "Contact name is required.", { name: "Required" });
  const created = await prisma.customerContact.create({
    data: { customerId, name: input.name.trim(), designation: input.designation.trim(), email: input.email.trim(), phone: input.phone.trim(), isPrimary: input.isPrimary, createdAt: new Date() },
  });
  await logAudit(actor.id, { action: "CONTACT_ADD", module: "customers", entityType: "client", entityId: customerId, oldValue: null, newValue: input });
  return created;
}

export interface DocumentMeta { docType: string; fileName: string; sizeBytes: number; mimeType: string }

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateDocumentMeta(m: DocumentMeta): FieldErrors {
  const e: FieldErrors = {};
  if (!m.docType) e.docType = "Select a document type.";
  if (!m.fileName) e.fileName = "File is required.";
  if (!ALLOWED_MIME.has(m.mimeType)) e.mimeType = "Only PDF, JPG, PNG or DOCX files are allowed.";
  if (m.sizeBytes > MAX_SIZE) e.sizeBytes = "File must be 10 MB or smaller.";
  return e;
}

export async function addDocument(actor: Actor, customerId: string, meta: DocumentMeta) {
  assert(actor, "documents");
  const errors = validateDocumentMeta(meta);
  if (Object.keys(errors).length) throw new CustomerError("VALIDATION", "Invalid document.", errors);
  // Note: no real storage backend is wired up (mock/in-memory data layer only)
  // — only the metadata + audit trail is persisted, not file bytes.
  const created = await prisma.customerDocument.create({
    data: { customerId, docType: meta.docType, fileName: meta.fileName, sizeBytes: meta.sizeBytes, mimeType: meta.mimeType, uploadedById: actor.id, uploadedAt: new Date() },
  });
  await logAudit(actor.id, { action: "DOCUMENT_UPLOAD", module: "customers", entityType: "client", entityId: customerId, oldValue: null, newValue: { fileName: meta.fileName, docType: meta.docType } });
  return created;
}

export { isScoped };
