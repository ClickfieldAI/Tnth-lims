// Customer Delivery service layer — authoritative server-side logic for
// Module 14. Mirrors lib/release/service.ts.
//
// No real email/portal-notification infrastructure exists in this project,
// so delivery is mocked: an EMAIL/PORTAL/MANUAL "send" is simulated
// synchronously (logged via the audit trail) rather than invented as a fake
// integration. A delivery can still be explicitly marked FAILED and retried,
// exercising the full status lifecycle the module is meant to track.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { DeliveryError, canDelivery, scopeToOwnCustomer, type Actor } from "./access";
import { validateCreateDelivery, type CreateDeliveryInput } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canDelivery>[1]) {
  if (!canDelivery(actor, cap)) throw new DeliveryError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadReportForDelivery(draftReportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await prisma.draftReport.findUnique({
    where: { id: draftReportId },
    include: { sampleRegistration: true, trf: true, customer: true, release: true, deliveries: { include: { deliveredBy: true } } },
  }) as any;
  if (!r) throw new DeliveryError("NOT_FOUND", "Report not found.");
  return r;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface DeliveryQueueParams { search?: string; status?: string; page?: number; pageSize?: number }

export async function listDeliveryQueue(actor: Actor, params: DeliveryQueueParams) {
  assert(actor, "view");
  const ownCustomer = scopeToOwnCustomer(actor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.draftReport.findMany({
    where: ownCustomer ? { customerId: ownCustomer } : undefined,
    include: { sampleRegistration: true, trf: true, customer: true, release: true, deliveries: { include: { deliveredBy: true } } },
  });
  // Only RELEASED reports are ever eligible for delivery — this is also the
  // exact gate the client-portal read path must use to expose reports.
  rows = rows.filter((r) => r.release?.status === "RELEASED");

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.reportCode, r.sampleRegistration?.sampleCode, r.trf?.trfCode, r.customer?.name].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows = rows.map((r) => ({ ...r, latestDelivery: (r.deliveries as any[]).slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null }));
  if (params.status) rows = rows.filter((r) => (r.latestDelivery?.status ?? "PENDING") === params.status);
  rows.sort((a, b) => b.release.releasedAt.getTime() - a.release.releasedAt.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => !r.latestDelivery || r.latestDelivery.status === "PENDING").length,
      delivered: rows.filter((r) => r.latestDelivery?.status === "DELIVERED").length,
      failed: rows.filter((r) => r.latestDelivery?.status === "FAILED").length,
    },
  };
}

/** Client-portal-facing read: released reports belonging to one customer only. Never exposes anything unreleased. */
export async function listReleasedReportsForCustomer(customerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.draftReport.findMany({
    where: { customerId },
    include: { sampleRegistration: true, release: true, deliveries: true },
  });
  return rows.filter((r) => r.release?.status === "RELEASED");
}

export async function getDeliveriesForReport(actor: Actor, draftReportId: string) {
  assert(actor, "view");
  const r = await loadReportForDelivery(draftReportId);
  const ownCustomer = scopeToOwnCustomer(actor);
  if (ownCustomer && r.customerId !== ownCustomer) throw new DeliveryError("FORBIDDEN", "Not your organization's report.");
  if (ownCustomer && r.release?.status !== "RELEASED") throw new DeliveryError("FORBIDDEN", "This report has not been released yet.");
  return r;
}

// ---------------------------------------------------------------------------
// Deliver / retry
// ---------------------------------------------------------------------------

export async function createDelivery(actor: Actor, draftReportId: string, input: CreateDeliveryInput) {
  assert(actor, "manage");
  const r = await loadReportForDelivery(draftReportId);
  if (r.release?.status !== "RELEASED") throw new DeliveryError("CONFLICT", "Only a released report can be delivered.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (r.deliveries as any[]).find((d) => ["PENDING", "DELIVERED"].includes(d.status));
  if (active) throw new DeliveryError("CONFLICT", "This report already has an active delivery — retry the failed attempt instead of creating a new one.", { deliveryMethod: "Duplicate active delivery." });

  const errors = validateCreateDelivery(input);
  if (Object.keys(errors).length) throw new DeliveryError("VALIDATION", "Please fix the highlighted fields.", errors);

  const now = new Date();
  const attemptNumber = (r.deliveries as { attemptNumber: number }[]).length + 1;
  // Mocked send: always succeeds synchronously (no real email/portal integration exists in this project).
  const created = await prisma.reportDelivery.create({
    data: {
      draftReportId, customerId: r.customerId, deliveryMethod: input.deliveryMethod, status: "DELIVERED",
      recipient: input.recipient, deliveredAt: now, deliveredById: actor.id, notes: input.notes ?? "", attemptNumber,
      createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actor.id, { action: "REPORT_DELIVERED", module: "report-delivery", entityType: "reportDelivery", entityId: created.id, oldValue: null, newValue: { draftReportId, method: input.deliveryMethod, recipient: input.recipient } });
  return { ok: true as const, id: created.id };
}

export async function markDeliveryFailed(actor: Actor, deliveryId: string, reason: string) {
  assert(actor, "manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = await prisma.reportDelivery.findUnique({ where: { id: deliveryId } }) as any;
  if (!d) throw new DeliveryError("NOT_FOUND", "Delivery not found.");
  if (d.status !== "PENDING" && d.status !== "DELIVERED") throw new DeliveryError("CONFLICT", "Only a pending or delivered attempt can be marked as failed.");

  await prisma.reportDelivery.update({ where: { id: deliveryId }, data: { status: "FAILED", notes: reason, updatedAt: new Date() } });
  await logAudit(actor.id, { action: "REPORT_DELIVERY_FAILED", module: "report-delivery", entityType: "reportDelivery", entityId: deliveryId, oldValue: { status: d.status }, newValue: { status: "FAILED", reason } });
  return { ok: true as const };
}

/** Explicit retry — the only way to create a new delivery attempt once the latest one has FAILED. */
export async function retryDelivery(actor: Actor, draftReportId: string, input: CreateDeliveryInput) {
  assert(actor, "manage");
  const r = await loadReportForDelivery(draftReportId);
  if (r.release?.status !== "RELEASED") throw new DeliveryError("CONFLICT", "Only a released report can be delivered.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = (r.deliveries as any[]).slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = sorted[0];
  if (latest && latest.status !== "FAILED") throw new DeliveryError("CONFLICT", "Only a failed delivery can be retried.");

  const errors = validateCreateDelivery(input);
  if (Object.keys(errors).length) throw new DeliveryError("VALIDATION", "Please fix the highlighted fields.", errors);

  const now = new Date();
  const created = await prisma.reportDelivery.create({
    data: {
      draftReportId, customerId: r.customerId, deliveryMethod: input.deliveryMethod, status: "DELIVERED",
      recipient: input.recipient, deliveredAt: now, deliveredById: actor.id, notes: input.notes ?? "", attemptNumber: (latest?.attemptNumber ?? 0) + 1,
      createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actor.id, { action: "REPORT_DELIVERY_RETRIED", module: "report-delivery", entityType: "reportDelivery", entityId: created.id, oldValue: { previousAttempt: latest?.id }, newValue: { draftReportId, method: input.deliveryMethod } });
  return { ok: true as const, id: created.id };
}

export async function getDeliveryHistory(actor: Actor, draftReportId: string) {
  assert(actor, "history");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deliveries = await prisma.reportDelivery.findMany({ where: { draftReportId } }) as any[];
  const ids = new Set(deliveries.map((d) => d.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = await prisma.auditLog.findMany({ where: { module: "report-delivery" }, orderBy: { createdAt: "desc" }, include: { actor: true } }) as any[];
  return all.filter((h) => ids.has(h.entityId));
}
