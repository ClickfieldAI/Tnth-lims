// Sample Registration service layer — authoritative server-side logic for
// Module 6. Mirrors lib/reviews/service.ts: server actions call into this,
// never the other way around.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextSampleCode } from "@/lib/ids";
import { RegistrationError, canRegistration, type Actor } from "./access";
import { validateRegisterSample, validateStorageUpdate, type RegisterSampleInput, type StorageUpdateInput } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canRegistration>[1]) {
  if (!canRegistration(actor, cap)) throw new RegistrationError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadTrfSample(trfSampleId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sample = await prisma.trfSample.findUnique({
    where: { id: trfSampleId },
    include: {
      tests: true,
      receipt: { include: { receivedBy: true } },
      technicalReview: { include: { reviewedBy: true } },
      registration: { include: { registeredBy: true, cancelledBy: true } },
      trf: { include: { customer: true, quotation: true } },
    },
  }) as any;
  if (!sample) throw new RegistrationError("NOT_FOUND", "Sample not found.");
  return sample;
}

function assertEligible(sample: { receipt: unknown; technicalReview: { status: string } | null; registration: { registrationStatus: string } | null }) {
  if (!sample.receipt) throw new RegistrationError("CONFLICT", "This sample's receipt has not been confirmed.");
  if (!sample.technicalReview || sample.technicalReview.status !== "ACCEPTED") {
    throw new RegistrationError("CONFLICT", "Only a sample with an accepted technical review can be registered.");
  }
  if (sample.registration && sample.registration.registrationStatus === "REGISTERED") {
    throw new RegistrationError("CONFLICT", "This sample has already been registered.");
  }
  if (sample.registration && sample.registration.registrationStatus === "CANCELLED") {
    throw new RegistrationError("CONFLICT", "This sample's registration was cancelled and cannot be reused.");
  }
}

// ---------------------------------------------------------------------------
// Registration queue
// ---------------------------------------------------------------------------

export interface RegistrationQueueParams {
  search?: string; registrationStatus?: string; customerId?: string; priority?: string;
  dateFrom?: string; dateTo?: string; page?: number; pageSize?: number;
}

export async function listRegistrationQueue(actor: Actor, params: RegistrationQueueParams) {
  assert(actor, "view"); // CLIENT has no capabilities here, so this already denies clients entirely.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trfs: any[] = await prisma.trf.findMany({
    where: { receiptConfirmedAt: { not: null } },
    include: { customer: true, samples: { include: { receipt: true, technicalReview: true, registration: true } } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  for (const t of trfs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of t.samples as any[]) {
      if (s.technicalReview?.status !== "ACCEPTED") continue; // only technically-accepted samples are eligible
      rows.push({
        trfId: t.id, trfCode: t.trfCode, customer: t.customer, priority: t.priority,
        sample: s, registrationStatus: s.registration?.registrationStatus ?? "PENDING_REGISTRATION",
        receivedAt: s.receipt?.receivedAt,
      });
    }
  }

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.trfCode, r.customer?.name, r.customer?.code, r.sample.sampleName, r.sample.batchNumber, r.sample.registration?.sampleCode].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.registrationStatus) rows = rows.filter((r) => r.registrationStatus === params.registrationStatus);
  if (params.customerId) rows = rows.filter((r) => r.customer?.id === params.customerId);
  if (params.priority) rows = rows.filter((r) => r.priority === params.priority);
  if (params.dateFrom) rows = rows.filter((r) => r.receivedAt && new Date(r.receivedAt) >= new Date(params.dateFrom!));
  if (params.dateTo) rows = rows.filter((r) => r.receivedAt && new Date(r.receivedAt) <= new Date(params.dateTo! + "T23:59:59"));

  rows.sort((a, b) => String(b.trfCode).localeCompare(String(a.trfCode)));

  const total = rows.length;
  const pageSize = params.pageSize ?? 10;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => r.registrationStatus === "PENDING_REGISTRATION").length,
      registered: rows.filter((r) => r.registrationStatus === "REGISTERED").length,
      cancelled: rows.filter((r) => r.registrationStatus === "CANCELLED").length,
    },
  };
}

export async function getSampleRegistrationData(actor: Actor, trfSampleId: string) {
  assert(actor, "view");
  const sample = await loadTrfSample(trfSampleId);
  if (actor.role === "CLIENT") throw new RegistrationError("FORBIDDEN", "Not available to client accounts.");
  return sample;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function registerSample(actor: Actor, trfSampleId: string, input: RegisterSampleInput) {
  assert(actor, "register");
  const sample = await loadTrfSample(trfSampleId);
  assertEligible(sample);

  const errors = validateRegisterSample(input);
  if (Object.keys(errors).length) throw new RegistrationError("VALIDATION", "Please fix the highlighted fields.", errors);

  // Re-check for an existing (non-cancelled) registration row right before
  // creating one — the closest this synchronous, single-threaded mock
  // engine can get to an atomic "verify-then-write", which is what prevents
  // a double-submit from creating two Sample IDs for the same trfSample.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await prisma.sampleRegistration.findFirst({ where: { trfSampleId } }) as any;
  if (existing && existing.registrationStatus !== "CANCELLED") {
    throw new RegistrationError("CONFLICT", "This sample has already been registered.");
  }

  // Counts every registration ever created (including cancelled ones) so a
  // cancelled Sample ID's sequence number is never reissued.
  const count = await prisma.sampleRegistration.count({});
  const sampleCode = nextSampleCode(count + 1);
  const now = new Date();

  const created = await prisma.sampleRegistration.create({
    data: {
      sampleCode, trfId: sample.trfId, trfSampleId, customerId: sample.trf.customerId,
      registrationStatus: "REGISTERED", registeredAt: now, registeredById: actor.id,
      storageCondition: input.storageCondition, storageLocation: input.storageLocation ?? "", remarks: input.remarks ?? "",
      barcodeValue: sampleCode, cancelledAt: null, cancelledById: null, cancellationReason: null,
      createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  await logAudit(actor.id, { action: "REGISTRATION_INITIATED", module: "sample-registration", entityType: "sampleRegistration", entityId: created.id, oldValue: null, newValue: { trfSampleId } });
  await logAudit(actor.id, { action: "SAMPLE_ID_GENERATED", module: "sample-registration", entityType: "sampleRegistration", entityId: created.id, oldValue: null, newValue: { sampleCode } });
  await logAudit(actor.id, { action: "SAMPLE_REGISTERED", module: "sample-registration", entityType: "sampleRegistration", entityId: created.id, oldValue: null, newValue: { sampleCode, trfId: sample.trfId, storageCondition: input.storageCondition } });
  await logAudit(actor.id, { action: "BARCODE_GENERATED", module: "sample-registration", entityType: "sampleRegistration", entityId: created.id, oldValue: null, newValue: { barcodeValue: sampleCode } });

  return { ok: true as const, id: created.id, sampleCode };
}

export async function cancelSampleRegistration(actor: Actor, registrationId: string, reason: string) {
  assert(actor, "cancel");
  if (!reason.trim()) throw new RegistrationError("VALIDATION", "A reason is required to cancel a sample registration.", { reason: "Required" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = await prisma.sampleRegistration.findUnique({ where: { id: registrationId } }) as any;
  if (!reg) throw new RegistrationError("NOT_FOUND", "Registration not found.");
  if (reg.registrationStatus !== "REGISTERED") throw new RegistrationError("CONFLICT", `Cannot cancel a registration in ${reg.registrationStatus} status.`);

  const now = new Date();
  await prisma.sampleRegistration.update({ where: { id: registrationId }, data: { registrationStatus: "CANCELLED", cancelledAt: now, cancelledById: actor.id, cancellationReason: reason, updatedAt: now } });
  await logAudit(actor.id, { action: "SAMPLE_REGISTRATION_CANCELLED", module: "sample-registration", entityType: "sampleRegistration", entityId: registrationId, oldValue: { status: "REGISTERED" }, newValue: { status: "CANCELLED", reason } });
  return { ok: true as const };
}

export async function updateSampleStorage(actor: Actor, registrationId: string, input: StorageUpdateInput) {
  assert(actor, "updateStorage");
  const errors = validateStorageUpdate(input);
  if (Object.keys(errors).length) throw new RegistrationError("VALIDATION", "Please fix the highlighted fields.", errors);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = await prisma.sampleRegistration.findUnique({ where: { id: registrationId } }) as any;
  if (!reg) throw new RegistrationError("NOT_FOUND", "Registration not found.");
  if (reg.registrationStatus !== "REGISTERED") throw new RegistrationError("CONFLICT", "Storage can only be updated for a registered sample.");

  const oldSnapshot = { storageCondition: reg.storageCondition, storageLocation: reg.storageLocation };
  await prisma.sampleRegistration.update({ where: { id: registrationId }, data: { storageCondition: input.storageCondition, storageLocation: input.storageLocation ?? "", remarks: input.remarks ?? reg.remarks, updatedAt: new Date() } });
  await logAudit(actor.id, { action: "STORAGE_LOCATION_CHANGED", module: "sample-registration", entityType: "sampleRegistration", entityId: registrationId, oldValue: oldSnapshot, newValue: { storageCondition: input.storageCondition, storageLocation: input.storageLocation } });
  return { ok: true as const };
}

export async function getRegistrationAuditHistory(actor: Actor, registrationId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "sample-registration", entityId: registrationId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}
