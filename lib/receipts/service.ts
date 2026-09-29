// Sample Receipt service layer — authoritative server-side logic for
// Module 4. Mirrors lib/trfs/service.ts: server actions call into this,
// never the other way around.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ReceiptError, canReceipt, type Actor } from "./access";
import { validateSampleReceipt, type SampleReceiptInput, type TrfReceiptStatus } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canReceipt>[1]) {
  if (!canReceipt(actor, cap)) throw new ReceiptError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadTrfForReceipt(trfId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = await prisma.trf.findUnique({
    where: { id: trfId },
    include: { customer: true, quotation: true, receiptConfirmedBy: true, samples: { include: { tests: true, receipt: { include: { receivedBy: true } } } } },
  }) as any;
  if (!t) throw new ReceiptError("NOT_FOUND", "TRF not found.");
  return t;
}

// ---------------------------------------------------------------------------
// Receipt queue
// ---------------------------------------------------------------------------

export interface ReceiptQueueParams {
  search?: string; receiptStatus?: string; priority?: string; dateFrom?: string; dateTo?: string;
  sortBy?: "trfCode" | "submittedAt" | "requestedDueDate"; sortDir?: "asc" | "desc"; page?: number; pageSize?: number;
}

export async function listReceiptQueue(actor: Actor, params: ReceiptQueueParams) {
  assert(actor, "view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.trf.findMany({
    where: { status: "ACCEPTED" },
    include: { customer: true, quotation: true, samples: { include: { receipt: true } } },
  });

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((t) => [t.trfCode, t.customer?.name, t.customer?.code, t.quotation?.quotationCode].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.receiptStatus) rows = rows.filter((t) => t.receiptStatus === params.receiptStatus);
  if (params.priority) rows = rows.filter((t) => t.priority === params.priority);
  if (params.dateFrom) rows = rows.filter((t) => t.submittedAt && t.submittedAt >= new Date(params.dateFrom!));
  if (params.dateTo) rows = rows.filter((t) => t.submittedAt && t.submittedAt <= new Date(params.dateTo! + "T23:59:59"));

  const sortBy = params.sortBy ?? "submittedAt";
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
      pending: rows.filter((t) => t.receiptStatus === "PENDING").length,
      partial: rows.filter((t) => t.receiptStatus === "PARTIAL").length,
      received: rows.filter((t) => t.receiptStatus === "RECEIVED").length,
      withDiscrepancy: rows.filter((t) => t.receiptStatus === "RECEIVED_WITH_DISCREPANCY").length,
    },
  };
}

export async function getTrfForReceipt(actor: Actor, trfId: string) {
  assert(actor, "view");
  const t = await loadTrfForReceipt(trfId);
  if (t.status !== "ACCEPTED" && t.receiptStatus === "PENDING") {
    // Still viewable (e.g. after full receipt the TRF might move on in a
    // later module) — but recording new receipts requires ACCEPTED below.
  }
  return t;
}

// ---------------------------------------------------------------------------
// Recording receipts
// ---------------------------------------------------------------------------

function recomputeTrfReceiptStatus(samples: { receipt: { hasDiscrepancy: boolean } | null }[]): TrfReceiptStatus {
  const received = samples.filter((s) => s.receipt);
  if (!received.length) return "PENDING";
  if (received.length < samples.length) return "PARTIAL";
  return received.some((s) => s.receipt!.hasDiscrepancy) ? "RECEIVED_WITH_DISCREPANCY" : "RECEIVED";
}

export async function recordSampleReceipt(actor: Actor, trfId: string, trfSampleId: string, input: SampleReceiptInput) {
  assert(actor, "record");
  const t = await loadTrfForReceipt(trfId);
  if (t.status !== "ACCEPTED") throw new ReceiptError("CONFLICT", "Only samples on an accepted TRF can be received.");
  if (t.receiptConfirmedAt) throw new ReceiptError("CONFLICT", "This TRF's receipt has already been confirmed and is now locked.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sample = (t.samples as any[]).find((s) => s.id === trfSampleId);
  if (!sample) throw new ReceiptError("NOT_FOUND", "Sample not found on this TRF.");

  const errors = validateSampleReceipt(input);
  if (Object.keys(errors).length) throw new ReceiptError("VALIDATION", "Please fix the highlighted fields.", errors);

  const now = new Date();
  const receivedAt = input.receivedTime ? new Date(`${input.receivedDate}T${input.receivedTime}`) : new Date(input.receivedDate);

  let receiptId: string;
  if (sample.receipt) {
    // Prevent silently overwriting an already-recorded receipt without it
    // being an explicit edit by an authorized user — allowed only pre-confirmation.
    await prisma.sampleReceipt.update({
      where: { id: sample.receipt.id },
      data: {
        receivedAt, receivedQuantity: input.receivedQuantity, receivedQuantityUnit: input.receivedQuantityUnit,
        containerCondition: input.containerCondition, sealCondition: input.sealCondition, temperature: input.temperature ?? "",
        storageCondition: input.storageCondition, storageLocation: input.storageLocation ?? "", remarks: input.remarks ?? "",
        hasDiscrepancy: input.hasDiscrepancy, discrepancyTypes: input.hasDiscrepancy ? input.discrepancyTypes : [],
        discrepancyRemarks: input.hasDiscrepancy ? (input.discrepancyRemarks ?? "") : "",
        receivedById: actor.id, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    receiptId = sample.receipt.id;
    await logAudit(actor.id, { action: "SAMPLE_RECEIPT_UPDATED", module: "receipts", entityType: "trf", entityId: trfId, oldValue: { trfSampleId, hasDiscrepancy: sample.receipt.hasDiscrepancy }, newValue: { trfSampleId, hasDiscrepancy: input.hasDiscrepancy } });
  } else {
    const created = await prisma.sampleReceipt.create({
      data: {
        trfId, trfSampleId, receivedAt, receivedQuantity: input.receivedQuantity, receivedQuantityUnit: input.receivedQuantityUnit,
        containerCondition: input.containerCondition, sealCondition: input.sealCondition, temperature: input.temperature ?? "",
        storageCondition: input.storageCondition, storageLocation: input.storageLocation ?? "", remarks: input.remarks ?? "",
        hasDiscrepancy: input.hasDiscrepancy, discrepancyTypes: input.hasDiscrepancy ? input.discrepancyTypes : [],
        discrepancyRemarks: input.hasDiscrepancy ? (input.discrepancyRemarks ?? "") : "",
        receivedById: actor.id, createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    receiptId = created.id;
    await logAudit(actor.id, { action: "SAMPLE_RECEIPT_RECORDED", module: "receipts", entityType: "trf", entityId: trfId, oldValue: null, newValue: { trfSampleId, hasDiscrepancy: input.hasDiscrepancy } });
  }

  // Recompute and persist the TRF-level rollup status.
  const refreshed = await loadTrfForReceipt(trfId);
  const status = recomputeTrfReceiptStatus(refreshed.samples);
  await prisma.trf.update({ where: { id: trfId }, data: { receiptStatus: status, updatedAt: now } });

  return { ok: true as const, id: receiptId };
}

export async function confirmTrfReceipt(actor: Actor, trfId: string) {
  assert(actor, "confirm");
  const t = await loadTrfForReceipt(trfId);
  if (t.status !== "ACCEPTED") throw new ReceiptError("CONFLICT", "Only an accepted TRF can have its receipt confirmed.");
  if (t.receiptConfirmedAt) throw new ReceiptError("CONFLICT", "Receipt has already been confirmed for this TRF.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unreceived = (t.samples as any[]).filter((s) => !s.receipt);
  if (unreceived.length) throw new ReceiptError("VALIDATION", `${unreceived.length} sample(s) have not been received yet. Record receipt for every sample before confirming.`);

  const now = new Date();
  const status = recomputeTrfReceiptStatus(t.samples);
  await prisma.trf.update({ where: { id: trfId }, data: { receiptStatus: status, receiptConfirmedAt: now, receiptConfirmedById: actor.id, updatedAt: now } });
  await logAudit(actor.id, { action: "TRF_RECEIPT_CONFIRMED", module: "receipts", entityType: "trf", entityId: trfId, oldValue: null, newValue: { receiptStatus: status, confirmedBy: actor.id } });
  // Note: this deliberately does not change the TRF's own workflow status —
  // receipt confirmation is a separate operational milestone, and neither
  // registers laboratory samples nor advances technical review (Module 6).
  return { ok: true as const, status };
}

export async function addDiscrepancyReview(actor: Actor, trfId: string, trfSampleId: string, comment: string) {
  assert(actor, "reviewDiscrepancy");
  if (!comment.trim()) throw new ReceiptError("VALIDATION", "A review comment is required.", { comment: "Required" });
  const t = await loadTrfForReceipt(trfId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sample = (t.samples as any[]).find((s) => s.id === trfSampleId);
  if (!sample?.receipt) throw new ReceiptError("NOT_FOUND", "No receipt record found for this sample.");

  await logAudit(actor.id, { action: "DISCREPANCY_REVIEWED", module: "receipts", entityType: "trf", entityId: trfId, oldValue: null, newValue: { trfSampleId, comment } });
  return { ok: true as const };
}

export async function getReceiptAuditHistory(actor: Actor, trfId: string) {
  assert(actor, "view");
  return prisma.auditLog.findMany({ where: { module: "receipts", entityId: trfId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}
