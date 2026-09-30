// Retention & Disposal service layer — authoritative server-side logic for
// Module 15. Mirrors lib/release/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { RetentionError, canRetention, type Actor } from "./access";
import { validateExtension, validateDisposalReason, DEFAULT_RETENTION_DAYS, type RetentionStatus } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canRetention>[1]) {
  if (!canRetention(actor, cap)) throw new RetentionError("FORBIDDEN", "You do not have permission to perform this action.");
}

/** Called by Module 13 when a report is released — enters the sample into retention if not already tracked. Not user-facing. */
export async function ensureRetentionRecord(actorId: string | null, sampleRegistrationId: string, trfId: string, customerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.retentionRecord.findFirst({ where: { sampleRegistrationId } }) as any;
  if (existing) return existing;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = await prisma.sampleRegistration.findUnique({ where: { id: sampleRegistrationId } }) as any;
  const now = new Date();
  const expiry = new Date(now.getTime() + DEFAULT_RETENTION_DAYS * 86400000);
  const created = await prisma.retentionRecord.create({
    data: {
      sampleRegistrationId, trfId, customerId, storageLocation: reg?.storageLocation ?? "",
      retentionStartDate: now, retentionExpiryDate: expiry, status: "RETAINED",
      disposalDate: null, disposalReason: null, disposedById: null, notes: "",
      createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actorId, { action: "RETENTION_STARTED", module: "retention", entityType: "retentionRecord", entityId: created.id, oldValue: null, newValue: { sampleRegistrationId, retentionExpiryDate: expiry } });
  return created;
}

async function loadRecord(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await prisma.retentionRecord.findUnique({
    where: { id },
    include: { sampleRegistration: { include: { trfSample: true } }, trf: true, customer: true, disposedBy: true },
  }) as any;
  if (!r) throw new RetentionError("NOT_FOUND", "Retention record not found.");
  return r;
}

/** DUE_FOR_DISPOSAL is computed, never persisted silently — mirrors the quotation-expiry pattern. */
function effectiveStatus(r: { status: string; retentionExpiryDate: Date }): RetentionStatus {
  if (r.status === "DISPOSED") return "DISPOSED";
  if (new Date(r.retentionExpiryDate) < new Date()) return "DUE_FOR_DISPOSAL";
  return r.status as RetentionStatus;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface RetentionQueueParams { search?: string; status?: string; page?: number; pageSize?: number }

export async function listRetentionQueue(actor: Actor, params: RetentionQueueParams) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.retentionRecord.findMany({
    include: { sampleRegistration: { include: { trfSample: true } }, trf: true, customer: true, disposedBy: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows = rows.map((r) => ({ ...r, effectiveStatus: effectiveStatus(r) }));

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.sampleRegistration?.sampleCode, r.trf?.trfCode, r.customer?.name, r.sampleRegistration?.trfSample?.sampleName].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.effectiveStatus === params.status);
  rows.sort((a, b) => a.retentionExpiryDate.getTime() - b.retentionExpiryDate.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      retained: rows.filter((r) => r.effectiveStatus === "RETAINED").length,
      dueForDisposal: rows.filter((r) => r.effectiveStatus === "DUE_FOR_DISPOSAL").length,
      extended: rows.filter((r) => r.effectiveStatus === "EXTENDED").length,
      disposed: rows.filter((r) => r.effectiveStatus === "DISPOSED").length,
    },
  };
}

export async function getRetentionRecord(actor: Actor, id: string) {
  assert(actor, "view");
  const r = await loadRecord(id);
  return { ...r, effectiveStatus: effectiveStatus(r) };
}

// ---------------------------------------------------------------------------
// Extend / dispose
// ---------------------------------------------------------------------------

export async function extendRetention(actor: Actor, id: string, newExpiryDate: string, reason?: string) {
  assert(actor, "extend");
  const r = await loadRecord(id);
  if (r.status === "DISPOSED") throw new RetentionError("CONFLICT", "A disposed sample's retention cannot be extended.");

  const errors = validateExtension(newExpiryDate, r.retentionExpiryDate);
  if (Object.keys(errors).length) throw new RetentionError("VALIDATION", "Please fix the highlighted fields.", errors);

  const oldExpiry = r.retentionExpiryDate;
  await prisma.retentionRecord.update({ where: { id }, data: { retentionExpiryDate: new Date(newExpiryDate), status: "EXTENDED", notes: reason ? `${r.notes ? r.notes + " | " : ""}Extended: ${reason}` : r.notes, updatedAt: new Date() } });
  await logAudit(actor.id, { action: "RETENTION_EXTENDED", module: "retention", entityType: "retentionRecord", entityId: id, oldValue: { retentionExpiryDate: oldExpiry }, newValue: { retentionExpiryDate: newExpiryDate, reason } });
  return { ok: true as const };
}

export async function disposeSample(actor: Actor, id: string, reason: string) {
  assert(actor, "dispose");
  const errors = validateDisposalReason(reason);
  if (Object.keys(errors).length) throw new RetentionError("VALIDATION", "A disposal reason is required.", errors);

  const r = await loadRecord(id);
  if (r.status === "DISPOSED") throw new RetentionError("CONFLICT", "This sample has already been disposed.");

  const now = new Date();
  // Never deletes the record — only marks it disposed, preserving full history.
  await prisma.retentionRecord.update({ where: { id }, data: { status: "DISPOSED", disposalDate: now, disposalReason: reason, disposedById: actor.id, updatedAt: now } });
  await logAudit(actor.id, { action: "SAMPLE_DISPOSED", module: "retention", entityType: "retentionRecord", entityId: id, oldValue: { status: r.status }, newValue: { status: "DISPOSED", reason, disposedBy: actor.id } });
  return { ok: true as const };
}

export async function getRetentionHistory(actor: Actor, id: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "retention", entityId: id }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}
