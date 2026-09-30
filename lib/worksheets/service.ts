// Worksheet Preparation service layer — authoritative server-side logic for
// Module 8. Mirrors lib/allocation/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextWorksheetCode } from "@/lib/ids";
import { WorksheetError, canWorksheet, scopeToOwnWorksheets, type Actor } from "./access";
import { validateCreateWorksheet, type CreateWorksheetInput } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canWorksheet>[1]) {
  if (!canWorksheet(actor, cap)) throw new WorksheetError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadWorksheet(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = await prisma.worksheet.findUnique({
    where: { id },
    include: {
      analyst: true, instrument: true, createdBy: true,
      items: { include: { testAllocation: { include: { trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } }, analyst: true, instrument: true } } } },
    },
  }) as any;
  if (!w) throw new WorksheetError("NOT_FOUND", "Worksheet not found.");
  return w;
}

async function loadAllocation(testAllocationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = await prisma.testAllocation.findUnique({
    where: { id: testAllocationId },
    include: { worksheetItem: true, trfTestRequest: true, analyst: true, instrument: true },
  }) as any;
  if (!a) throw new WorksheetError("NOT_FOUND", "Allocated test not found.");
  return a;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface WorksheetQueueParams {
  search?: string; status?: string; analystId?: string; page?: number; pageSize?: number;
}

export async function listWorksheets(actor: Actor, params: WorksheetQueueParams) {
  assert(actor, "view");
  const ownScope = scopeToOwnWorksheets(actor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = await prisma.worksheet.findMany({
    where: ownScope ? { analystId: ownScope } : undefined,
    include: { analyst: true, instrument: true, items: { include: { testAllocation: { include: { trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } } } } } } },
  });

  const q = params.search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((w) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [w.worksheetCode, ...(w.items as any[]).flatMap((it) => [it.testAllocation.trfTestRequest.sample.registration?.sampleCode, it.testAllocation.trfTestRequest.sample.trf?.trfCode, it.testAllocation.trfTestRequest.sample.trf?.customer?.name])]
        .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  }
  if (params.status) rows = rows.filter((w) => w.status === params.status);
  if (params.analystId) rows = rows.filter((w) => w.analystId === params.analystId);

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      total: rows.length,
      draft: rows.filter((w) => w.status === "DRAFT").length,
      prepared: rows.filter((w) => w.status === "PREPARED").length,
      assigned: rows.filter((w) => w.status === "ASSIGNED").length,
      inProgress: rows.filter((w) => w.status === "IN_PROGRESS").length,
    },
  };
}

export async function getWorksheet(actor: Actor, id: string) {
  assert(actor, "view");
  const w = await loadWorksheet(id);
  const ownScope = scopeToOwnWorksheets(actor);
  if (ownScope && w.analystId !== ownScope) throw new WorksheetError("FORBIDDEN", "Not your worksheet.");
  return w;
}

/** Allocated tests not yet on any worksheet — the pool available to build a new worksheet from. */
export async function listAvailableAllocations(actor: Actor) {
  assert(actor, "create");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocations: any[] = await prisma.testAllocation.findMany({
    include: {
      worksheetItem: true, analyst: true, instrument: true,
      trfTestRequest: { include: { sample: { include: { trf: { include: { customer: true } }, registration: true } } } },
    },
  });
  return allocations.filter((a) => !a.worksheetItem);
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

async function assertAllocationsUsable(testAllocationIds: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocations: any[] = [];
  for (const id of testAllocationIds) {
    const a = await loadAllocation(id);
    if (a.worksheetItem) throw new WorksheetError("CONFLICT", "One of the selected tests is already on another worksheet.", { testAllocationIds: "Duplicate active allocation on a worksheet." });
    allocations.push(a);
  }
  return allocations;
}

export async function createWorksheet(actor: Actor, input: CreateWorksheetInput) {
  assert(actor, "create");
  const errors = validateCreateWorksheet(input);
  if (Object.keys(errors).length) throw new WorksheetError("VALIDATION", "Please fix the highlighted fields.", errors);

  const allocations = await assertAllocationsUsable(input.testAllocationIds);
  const analystIds = new Set(allocations.map((a) => a.analystId));
  const analystId = input.analystId || (analystIds.size === 1 ? allocations[0].analystId : undefined);
  if (!analystId) throw new WorksheetError("VALIDATION", "The selected tests are allocated to different analysts — choose an analyst for this worksheet explicitly.", { analystId: "Required" });

  const now = new Date();
  const count = await prisma.worksheet.count({});
  const code = nextWorksheetCode(count + 1);
  const created = await prisma.worksheet.create({
    data: {
      worksheetCode: code, analystId, instrumentId: input.instrumentId || allocations[0].instrumentId || null,
      notes: input.notes ?? "", dueDate: input.dueDate ? new Date(input.dueDate) : null, status: "DRAFT",
      createdById: actor.id, assignedAt: null, createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  for (const a of allocations) {
    await prisma.worksheetItem.create({ data: { worksheetId: created.id, testAllocationId: a.id, createdAt: now } });
  }
  await logAudit(actor.id, { action: "WORKSHEET_CREATED", module: "worksheets", entityType: "worksheet", entityId: created.id, oldValue: null, newValue: { worksheetCode: code, testAllocationIds: input.testAllocationIds } });
  return { ok: true as const, id: created.id, worksheetCode: code };
}

export async function updateWorksheetDraft(actor: Actor, id: string, input: { notes?: string; dueDate?: string; instrumentId?: string }) {
  assert(actor, "edit");
  const w = await loadWorksheet(id);
  if (w.status !== "DRAFT") throw new WorksheetError("CONFLICT", "Only a draft worksheet can be edited.");

  const oldSnapshot = { notes: w.notes, dueDate: w.dueDate, instrumentId: w.instrumentId };
  await prisma.worksheet.update({ where: { id }, data: { notes: input.notes ?? w.notes, dueDate: input.dueDate ? new Date(input.dueDate) : w.dueDate, instrumentId: input.instrumentId ?? w.instrumentId, updatedAt: new Date() } });
  await logAudit(actor.id, { action: "WORKSHEET_UPDATED", module: "worksheets", entityType: "worksheet", entityId: id, oldValue: oldSnapshot, newValue: input });
  return { ok: true as const };
}

export async function addTestToWorksheet(actor: Actor, worksheetId: string, testAllocationId: string) {
  assert(actor, "edit");
  const w = await loadWorksheet(worksheetId);
  if (w.status !== "DRAFT") throw new WorksheetError("CONFLICT", "Tests can only be added to a draft worksheet.");
  const [allocation] = await assertAllocationsUsable([testAllocationId]);
  await prisma.worksheetItem.create({ data: { worksheetId, testAllocationId, createdAt: new Date() } });
  await logAudit(actor.id, { action: "WORKSHEET_TEST_ADDED", module: "worksheets", entityType: "worksheet", entityId: worksheetId, oldValue: null, newValue: { testAllocationId } });
  return { ok: true as const, id: allocation.id };
}

export async function removeTestFromWorksheet(actor: Actor, worksheetId: string, testAllocationId: string) {
  assert(actor, "edit");
  const w = await loadWorksheet(worksheetId);
  if (w.status !== "DRAFT") throw new WorksheetError("CONFLICT", "Tests can only be removed from a draft worksheet.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = (w.items as any[]).find((it) => it.testAllocationId === testAllocationId);
  if (!item) throw new WorksheetError("NOT_FOUND", "This test is not on this worksheet.");
  await prisma.worksheetItem.delete({ where: { id: item.id } });
  await logAudit(actor.id, { action: "WORKSHEET_TEST_REMOVED", module: "worksheets", entityType: "worksheet", entityId: worksheetId, oldValue: { testAllocationId }, newValue: null });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function prepareWorksheet(actor: Actor, id: string) {
  assert(actor, "edit");
  const w = await loadWorksheet(id);
  if (w.status !== "DRAFT") throw new WorksheetError("CONFLICT", "Only a draft worksheet can be prepared.");
  if (!w.items.length) throw new WorksheetError("VALIDATION", "Add at least one allocated test before preparing this worksheet.");

  await prisma.worksheet.update({ where: { id }, data: { status: "PREPARED", updatedAt: new Date() } });
  await logAudit(actor.id, { action: "WORKSHEET_PREPARED", module: "worksheets", entityType: "worksheet", entityId: id, oldValue: { status: "DRAFT" }, newValue: { status: "PREPARED" } });
  return { ok: true as const };
}

export async function assignWorksheet(actor: Actor, id: string) {
  assert(actor, "assign");
  const w = await loadWorksheet(id);
  if (w.status !== "PREPARED") throw new WorksheetError("CONFLICT", "Only a prepared worksheet can be assigned.");

  const now = new Date();
  await prisma.worksheet.update({ where: { id }, data: { status: "ASSIGNED", assignedAt: now, updatedAt: now } });
  await logAudit(actor.id, { action: "WORKSHEET_ASSIGNED", module: "worksheets", entityType: "worksheet", entityId: id, oldValue: { status: "PREPARED" }, newValue: { status: "ASSIGNED", analystId: w.analystId } });
  return { ok: true as const };
}

/** Called from Module 9 when the assigned analyst begins entering results — not a user-facing action of this module. */
export async function markWorksheetInProgress(worksheetId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = await prisma.worksheet.findUnique({ where: { id: worksheetId } }) as any;
  if (w && w.status === "ASSIGNED") {
    await prisma.worksheet.update({ where: { id: worksheetId }, data: { status: "IN_PROGRESS", updatedAt: new Date() } });
    await logAudit(null, { action: "WORKSHEET_IN_PROGRESS", module: "worksheets", entityType: "worksheet", entityId: worksheetId, oldValue: { status: "ASSIGNED" }, newValue: { status: "IN_PROGRESS" } });
  }
}

export async function getWorksheetHistory(actor: Actor, worksheetId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "worksheets", entityId: worksheetId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}
