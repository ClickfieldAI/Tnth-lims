// Technical Verification service layer — authoritative server-side logic for
// Module 10. Mirrors lib/result-entry/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { VerificationError, canVerification, scopeToOwnResults, type Actor } from "./access";
import { validateReturnReason } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canVerification>[1]) {
  if (!canVerification(actor, cap)) throw new VerificationError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadResult(testResultId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await prisma.testResult.findUnique({
    where: { id: testResultId },
    include: {
      analyst: true, instrumentUsed: true, verification: { include: { reviewer: true } },
      testAllocation: { include: { trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } } } },
    },
  }) as any;
  if (!r) throw new VerificationError("NOT_FOUND", "Test result not found.");
  return r;
}

async function ensureVerificationRow(testResultId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let v = await prisma.technicalVerification.findFirst({ where: { testResultId } }) as any;
  if (!v) {
    const now = new Date();
    v = await prisma.technicalVerification.create({
      data: { testResultId, status: "PENDING", reviewerId: null, reviewedAt: null, comments: "", returnReason: null, createdAt: now, updatedAt: now },
    });
  }
  return v;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface VerificationQueueParams {
  search?: string; status?: string; page?: number; pageSize?: number;
}

export async function listVerificationQueue(actor: Actor, params: VerificationQueueParams) {
  assert(actor, "view");
  const ownScope = scopeToOwnResults(actor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = await prisma.testResult.findMany({
    where: { status: "COMPLETED" },
    include: {
      analyst: true, verification: { include: { reviewer: true } },
      testAllocation: { include: { trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } } } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = results
    .filter((r) => !ownScope || r.analystId === ownScope)
    .map((r) => ({
      testResultId: r.id, sampleCode: r.testAllocation.trfTestRequest.sample.registration?.sampleCode,
      trfCode: r.testAllocation.trfTestRequest.sample.trf?.trfCode, customer: r.testAllocation.trfTestRequest.sample.trf?.customer,
      requestedParameter: r.testAllocation.trfTestRequest.requestedParameter, analyst: r.analyst,
      resultValue: r.resultValue, unit: r.unit, referenceValue: r.referenceValue,
      status: r.verification?.status ?? "PENDING", verification: r.verification, analystId: r.analystId,
    }));

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.sampleCode, r.trfCode, r.customer?.name, r.requestedParameter].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.status === params.status);

  rows.sort((a, b) => String(b.sampleCode).localeCompare(String(a.sampleCode)));

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => r.status === "PENDING").length,
      verified: rows.filter((r) => r.status === "VERIFIED").length,
      returned: rows.filter((r) => r.status === "RETURNED").length,
    },
  };
}

export async function getResultForVerification(actor: Actor, testResultId: string) {
  assert(actor, "view");
  return loadResult(testResultId);
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

function assertSeparationOfDuties(actor: Actor, analystId: string) {
  if (actor.role === "ADMIN") return; // exempt, matching the pattern used everywhere else in this app
  if (actor.id === analystId) throw new VerificationError("FORBIDDEN", "You cannot verify a result you personally entered — separation of duties requires a different reviewer.");
}

export async function verifyResult(actor: Actor, testResultId: string, comments?: string) {
  assert(actor, "verify");
  const r = await loadResult(testResultId);
  if (r.status !== "COMPLETED") throw new VerificationError("CONFLICT", "Only a completed result can be verified.");
  assertSeparationOfDuties(actor, r.analystId);

  const v = await ensureVerificationRow(testResultId);
  if (v.status === "VERIFIED") throw new VerificationError("CONFLICT", "This result is already verified.");

  const now = new Date();
  await prisma.technicalVerification.update({ where: { id: v.id }, data: { status: "VERIFIED", reviewerId: actor.id, reviewedAt: now, comments: comments ?? "", returnReason: null, updatedAt: now } });
  await logAudit(actor.id, { action: "RESULT_VERIFIED", module: "technical-verification", entityType: "technicalVerification", entityId: v.id, oldValue: { status: v.status }, newValue: { status: "VERIFIED", testResultId } });
  return { ok: true as const, id: v.id };
}

export async function returnResult(actor: Actor, testResultId: string, reason: string) {
  assert(actor, "verify");
  const errors = validateReturnReason(reason);
  if (Object.keys(errors).length) throw new VerificationError("VALIDATION", "A reason is required.", errors);

  const r = await loadResult(testResultId);
  if (r.status !== "COMPLETED") throw new VerificationError("CONFLICT", "Only a completed result can be returned.");
  assertSeparationOfDuties(actor, r.analystId);

  const v = await ensureVerificationRow(testResultId);
  if (v.status === "VERIFIED") throw new VerificationError("CONFLICT", "A verified result cannot be returned directly — request a correction first.");

  const now = new Date();
  // Reopen the underlying result for correction, and reset verification to
  // PENDING so it re-enters the queue once the analyst fixes and re-completes it.
  await prisma.testResult.update({ where: { id: testResultId }, data: { status: "IN_PROGRESS", updatedAt: now } });
  await prisma.technicalVerification.update({ where: { id: v.id }, data: { status: "RETURNED", reviewerId: actor.id, reviewedAt: now, returnReason: reason, updatedAt: now } });
  await logAudit(actor.id, { action: "RESULT_RETURNED", module: "technical-verification", entityType: "technicalVerification", entityId: v.id, oldValue: { status: v.status }, newValue: { status: "RETURNED", reason, testResultId } });
  return { ok: true as const, id: v.id };
}

export async function getVerificationHistory(actor: Actor, technicalVerificationId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "technical-verification", entityId: technicalVerificationId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}
