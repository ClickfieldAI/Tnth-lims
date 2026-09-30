// Testing & Result Entry service layer — authoritative server-side logic for
// Module 9. Mirrors lib/worksheets/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { markWorksheetInProgress } from "@/lib/worksheets/service";
import { ResultEntryError, canResultEntry, scopeToOwnTests, type Actor } from "./access";
import { validateResultEntry, validateCorrectionReason, type ResultEntryInput } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canResultEntry>[1]) {
  if (!canResultEntry(actor, cap)) throw new ResultEntryError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadAllocation(testAllocationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = await prisma.testAllocation.findUnique({
    where: { id: testAllocationId },
    include: {
      analyst: true, instrument: true, result: true, worksheetItem: { include: { worksheet: true } },
      trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } },
    },
  }) as any;
  if (!a) throw new ResultEntryError("NOT_FOUND", "Allocated test not found.");
  return a;
}

function assertAuthorizedAnalyst(actor: Actor, allocation: { analystId: string }) {
  const own = scopeToOwnTests(actor);
  if (own && allocation.analystId !== own) throw new ResultEntryError("FORBIDDEN", "You are not the analyst assigned to this test.");
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface TestingQueueParams {
  search?: string; status?: string; analystId?: string; page?: number; pageSize?: number;
}

export async function listTestingQueue(actor: Actor, params: TestingQueueParams) {
  assert(actor, "view");
  const ownScope = scopeToOwnTests(actor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocations: any[] = await prisma.testAllocation.findMany({
    where: ownScope ? { analystId: ownScope } : undefined,
    include: {
      analyst: true, instrument: true, result: true, worksheetItem: { include: { worksheet: true } },
      trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = allocations
    .filter((a) => a.worksheetItem) // only tests that have reached a worksheet are "in testing"
    .map((a) => ({
      testAllocationId: a.id, sampleCode: a.trfTestRequest.sample.registration?.sampleCode, trfCode: a.trfTestRequest.sample.trf?.trfCode,
      customer: a.trfTestRequest.sample.trf?.customer, requestedParameter: a.trfTestRequest.requestedParameter,
      analyst: a.analyst, worksheetCode: a.worksheetItem.worksheet.worksheetCode, worksheetStatus: a.worksheetItem.worksheet.status,
      status: a.result?.status ?? "NOT_STARTED", result: a.result,
    }));

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.sampleCode, r.trfCode, r.customer?.name, r.requestedParameter, r.worksheetCode].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  if (params.analystId) rows = rows.filter((r) => r.analyst?.id === params.analystId);

  rows.sort((a, b) => String(b.sampleCode).localeCompare(String(a.sampleCode)));

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      notStarted: rows.filter((r) => r.status === "NOT_STARTED").length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      completed: rows.filter((r) => r.status === "COMPLETED").length,
    },
  };
}

export async function getAllocationForTesting(actor: Actor, testAllocationId: string) {
  assert(actor, "view");
  const a = await loadAllocation(testAllocationId);
  const ownScope = scopeToOwnTests(actor);
  if (ownScope && a.analystId !== ownScope) throw new ResultEntryError("FORBIDDEN", "Not your assigned test.");
  return a;
}

// ---------------------------------------------------------------------------
// Result entry
// ---------------------------------------------------------------------------

export async function saveResult(actor: Actor, testAllocationId: string, input: ResultEntryInput) {
  assert(actor, "enter");
  const a = await loadAllocation(testAllocationId);
  assertAuthorizedAnalyst(actor, a);
  if (!a.worksheetItem) throw new ResultEntryError("CONFLICT", "This test has not been placed on a worksheet yet.");
  if (a.result && a.result.status === "COMPLETED") throw new ResultEntryError("CONFLICT", "This result is completed — use the correction path to change it.");

  // Never trust a client-supplied "numeric expected" flag — recompute from
  // whether a unit was actually specified for this result.
  const isNumeric = !!input.unit?.trim();
  const errors = validateResultEntry({ ...input, isNumeric });
  if (Object.keys(errors).length) throw new ResultEntryError("VALIDATION", "Please fix the highlighted fields.", errors);

  const now = new Date();
  let resultId: string;
  if (a.result) {
    await prisma.testResult.update({
      where: { id: a.result.id },
      data: {
        resultValue: input.resultValue, unit: input.unit ?? "", referenceValue: input.referenceValue ?? "", remarks: input.remarks ?? "",
        instrumentUsedId: input.instrumentUsedId || a.instrumentId || null, testDate: new Date(input.testDate), status: "IN_PROGRESS", updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    resultId = a.result.id;
    await logAudit(actor.id, { action: "RESULT_MODIFIED", module: "testing", entityType: "testResult", entityId: resultId, oldValue: { resultValue: a.result.resultValue }, newValue: { resultValue: input.resultValue } });
  } else {
    const created = await prisma.testResult.create({
      data: {
        testAllocationId, worksheetId: a.worksheetItem.worksheetId, analystId: a.analystId,
        resultValue: input.resultValue, unit: input.unit ?? "", referenceValue: input.referenceValue ?? "", remarks: input.remarks ?? "",
        instrumentUsedId: input.instrumentUsedId || a.instrumentId || null, testDate: new Date(input.testDate), status: "IN_PROGRESS",
        completedAt: null, correctionReason: null, createdAt: now, updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    resultId = created.id;
    await logAudit(actor.id, { action: "RESULT_CREATED", module: "testing", entityType: "testResult", entityId: resultId, oldValue: null, newValue: { resultValue: input.resultValue, testAllocationId } });
    await markWorksheetInProgress(a.worksheetItem.worksheetId);
  }

  return { ok: true as const, id: resultId };
}

export async function completeResult(actor: Actor, testAllocationId: string) {
  assert(actor, "complete");
  const a = await loadAllocation(testAllocationId);
  assertAuthorizedAnalyst(actor, a);
  if (!a.result) throw new ResultEntryError("CONFLICT", "Enter a result before marking this test complete.");
  if (a.result.status === "COMPLETED") throw new ResultEntryError("CONFLICT", "This result is already completed.");

  const now = new Date();
  await prisma.testResult.update({ where: { id: a.result.id }, data: { status: "COMPLETED", completedAt: now, updatedAt: now } });
  await logAudit(actor.id, { action: "TEST_COMPLETED", module: "testing", entityType: "testResult", entityId: a.result.id, oldValue: { status: a.result.status }, newValue: { status: "COMPLETED" } });

  // If this result was previously returned by a technical reviewer, re-completing
  // it after the fix puts it back into the verification queue as PENDING.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verification = await prisma.technicalVerification.findFirst({ where: { testResultId: a.result.id } }) as any;
  if (verification && verification.status === "RETURNED") {
    await prisma.technicalVerification.update({ where: { id: verification.id }, data: { status: "PENDING", returnReason: null, updatedAt: now } });
  }

  return { ok: true as const };
}

/** The only way to change a COMPLETED result — always audited with a reason (never a silent overwrite). */
export async function correctResult(actor: Actor, testAllocationId: string, input: ResultEntryInput, correctionReason: string) {
  assert(actor, "correct");
  const a = await loadAllocation(testAllocationId);
  if (!a.result || a.result.status !== "COMPLETED") throw new ResultEntryError("CONFLICT", "Only a completed result can be corrected — edit it directly instead.");

  const reasonErrors = validateCorrectionReason(correctionReason);
  if (Object.keys(reasonErrors).length) throw new ResultEntryError("VALIDATION", "A correction reason is required.", reasonErrors);
  const isNumeric = !!input.unit?.trim();
  const errors = validateResultEntry({ ...input, isNumeric });
  if (Object.keys(errors).length) throw new ResultEntryError("VALIDATION", "Please fix the highlighted fields.", errors);

  const oldSnapshot = { resultValue: a.result.resultValue, unit: a.result.unit, referenceValue: a.result.referenceValue };
  await prisma.testResult.update({
    where: { id: a.result.id },
    data: {
      resultValue: input.resultValue, unit: input.unit ?? "", referenceValue: input.referenceValue ?? "", remarks: input.remarks ?? "",
      testDate: new Date(input.testDate), correctionReason, updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actor.id, { action: "RESULT_CORRECTED", module: "testing", entityType: "testResult", entityId: a.result.id, oldValue: oldSnapshot, newValue: { resultValue: input.resultValue, reason: correctionReason } });

  // A verified result is locked from normal editing; correcting it through
  // this authorized path reopens technical verification for that result,
  // rather than silently leaving a stale VERIFIED decision in place.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verification = await prisma.technicalVerification.findFirst({ where: { testResultId: a.result.id } }) as any;
  if (verification && verification.status === "VERIFIED") {
    await prisma.technicalVerification.update({ where: { id: verification.id }, data: { status: "PENDING", updatedAt: new Date() } });
    await logAudit(actor.id, { action: "VERIFICATION_REOPENED_FOR_CORRECTION", module: "technical-verification", entityType: "technicalVerification", entityId: verification.id, oldValue: { status: "VERIFIED" }, newValue: { status: "PENDING", reason: correctionReason } });
  }

  return { ok: true as const };
}

export async function getResultHistory(actor: Actor, testResultId: string) {
  assert(actor, "view");
  return prisma.auditLog.findMany({ where: { module: "testing", entityId: testResultId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}
