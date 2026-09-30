// Test Allocation service layer — authoritative server-side logic for
// Module 7. Mirrors lib/registration/service.ts.
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { findService } from "@/lib/enquiries/catalog";
import { AllocationError, canAllocation, scopeToOwnAllocations, type Actor } from "./access";
import { validateAllocateTest, type AllocateTestInput, type SampleAllocationStatus } from "./validation";

function assert(actor: Actor, cap: Parameters<typeof canAllocation>[1]) {
  if (!canAllocation(actor, cap)) throw new AllocationError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function loadTestRequest(trfTestRequestId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tr = await prisma.trfTestRequest.findUnique({
    where: { id: trfTestRequestId },
    include: {
      allocation: { include: { analyst: true, instrument: true, allocatedBy: true } },
      sample: { include: { trf: { include: { customer: true } }, registration: true } },
    },
  }) as any;
  if (!tr) throw new AllocationError("NOT_FOUND", "Requested test not found.");
  return tr;
}

async function assertAnalystValid(analystId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await prisma.user.findUnique({ where: { id: analystId }, include: { role: true } }) as any;
  if (!user || !user.isActive) throw new AllocationError("VALIDATION", "Select a valid analyst.", { analystId: "Analyst not found." });
  if (!["ANALYST", "MICRO"].includes(user.role.name)) {
    throw new AllocationError("VALIDATION", "The selected user is not an Analyst or Microbiology Analyst.", { analystId: "Not a testing-discipline user." });
  }
  return user;
}

async function assertInstrumentValid(instrumentId?: string) {
  if (!instrumentId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } }) as any;
  if (!instrument) throw new AllocationError("VALIDATION", "Select a valid instrument.", { instrumentId: "Instrument not found." });
  if (["OFFLINE", "MAINTENANCE"].includes(instrument.status)) {
    throw new AllocationError("VALIDATION", `This instrument is currently ${instrument.status.toLowerCase()} and cannot be allocated.`, { instrumentId: "Instrument unavailable." });
  }
  return instrument;
}

function assertEligible(tr: { sample: { registration: { registrationStatus: string } | null } }) {
  if (!tr.sample.registration || tr.sample.registration.registrationStatus !== "REGISTERED") {
    throw new AllocationError("CONFLICT", "Only a registered, non-cancelled sample's tests can be allocated.");
  }
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface AllocationQueueParams {
  search?: string; status?: string; priority?: string; analystId?: string; page?: number; pageSize?: number;
}

export async function listAllocationQueue(actor: Actor, params: AllocationQueueParams) {
  assert(actor, "view");
  const ownScope = scopeToOwnAllocations(actor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registrations: any[] = await prisma.sampleRegistration.findMany({
    where: { registrationStatus: "REGISTERED" },
    include: {
      customer: true, trf: true,
      trfSample: { include: { tests: { include: { allocation: { include: { analyst: true, instrument: true } } } } } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  for (const reg of registrations) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of reg.trfSample.tests as any[]) {
      if (ownScope && t.allocation?.analystId !== ownScope) continue; // analysts only see their own allocated tests
      if (ownScope && !t.allocation) continue;
      rows.push({
        testRequestId: t.id, sampleCode: reg.sampleCode, trfCode: reg.trf?.trfCode, customer: reg.customer,
        productName: reg.trfSample.sampleName, requestedParameter: t.requestedParameter,
        serviceDivision: t.customRequest ? t.customServiceName : (findService(t.serviceId)?.division ?? t.serviceId),
        method: t.preferredMethod, allocation: t.allocation,
        status: t.allocation ? "ALLOCATED" : "PENDING",
      });
    }
  }

  const q = params.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.sampleCode, r.trfCode, r.customer?.name, r.productName, r.requestedParameter].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q)));
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  if (params.priority) rows = rows.filter((r) => r.allocation?.priority === params.priority);
  if (params.analystId) rows = rows.filter((r) => r.allocation?.analystId === params.analystId);

  rows.sort((a, b) => String(b.sampleCode).localeCompare(String(a.sampleCode)));

  const total = rows.length;
  const pageSize = params.pageSize ?? 15;
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;

  // Sample-level rollup stats (PENDING / PARTIALLY_ALLOCATED / ALLOCATED).
  const bySample = new Map<string, { total: number; allocated: number }>();
  for (const r of rows) {
    const s = bySample.get(r.sampleCode) ?? { total: 0, allocated: 0 };
    s.total += 1; if (r.status === "ALLOCATED") s.allocated += 1;
    bySample.set(r.sampleCode, s);
  }
  let pendingSamples = 0, partialSamples = 0, allocatedSamples = 0;
  for (const s of bySample.values()) {
    if (s.allocated === 0) pendingSamples += 1;
    else if (s.allocated < s.total) partialSamples += 1;
    else allocatedSamples += 1;
  }

  return {
    rows: rows.slice(start, start + pageSize), total, page, pageSize,
    stats: {
      totalTests: rows.length, pendingTests: rows.filter((r) => r.status === "PENDING").length, allocatedTests: rows.filter((r) => r.status === "ALLOCATED").length,
      pendingSamples, partialSamples, allocatedSamples,
    },
  };
}

export async function getTestRequestForAllocation(actor: Actor, trfTestRequestId: string) {
  assert(actor, "view");
  return loadTestRequest(trfTestRequestId);
}

// ---------------------------------------------------------------------------
// Allocate / reassign
// ---------------------------------------------------------------------------

export async function allocateTest(actor: Actor, trfTestRequestId: string, input: AllocateTestInput) {
  assert(actor, "allocate");
  const tr = await loadTestRequest(trfTestRequestId);
  assertEligible(tr);
  if (tr.allocation) throw new AllocationError("CONFLICT", "This test is already allocated — use reassign instead.");

  const errors = validateAllocateTest(input);
  if (Object.keys(errors).length) throw new AllocationError("VALIDATION", "Please fix the highlighted fields.", errors);
  await assertAnalystValid(input.analystId);
  await assertInstrumentValid(input.instrumentId);

  const now = new Date();
  const created = await prisma.testAllocation.create({
    data: {
      trfTestRequestId, analystId: input.analystId, instrumentId: input.instrumentId || null,
      priority: input.priority, dueDate: new Date(input.dueDate), allocatedById: actor.id, allocatedAt: now,
      createdAt: now, updatedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await logAudit(actor.id, { action: "TEST_ALLOCATED", module: "test-allocation", entityType: "testAllocation", entityId: created.id, oldValue: null, newValue: { trfTestRequestId, analystId: input.analystId, priority: input.priority, dueDate: input.dueDate } });
  return { ok: true as const, id: created.id };
}

export async function reassignTest(actor: Actor, trfTestRequestId: string, input: AllocateTestInput) {
  assert(actor, "reassign");
  const tr = await loadTestRequest(trfTestRequestId);
  assertEligible(tr);
  if (!tr.allocation) throw new AllocationError("CONFLICT", "This test has not been allocated yet — use allocate instead.");

  const errors = validateAllocateTest(input);
  if (Object.keys(errors).length) throw new AllocationError("VALIDATION", "Please fix the highlighted fields.", errors);
  await assertAnalystValid(input.analystId);
  await assertInstrumentValid(input.instrumentId);

  const oldSnapshot = { analystId: tr.allocation.analystId, priority: tr.allocation.priority, dueDate: tr.allocation.dueDate };
  await prisma.testAllocation.update({
    where: { id: tr.allocation.id },
    data: { analystId: input.analystId, instrumentId: input.instrumentId || null, priority: input.priority, dueDate: new Date(input.dueDate), updatedAt: new Date() },
  });
  await logAudit(actor.id, { action: "TEST_REASSIGNED", module: "test-allocation", entityType: "testAllocation", entityId: tr.allocation.id, oldValue: oldSnapshot, newValue: { analystId: input.analystId, priority: input.priority, dueDate: input.dueDate } });
  return { ok: true as const, id: tr.allocation.id };
}

export async function getAllocationHistory(actor: Actor, testAllocationId: string) {
  assert(actor, "history");
  return prisma.auditLog.findMany({ where: { module: "test-allocation", entityId: testAllocationId }, orderBy: { createdAt: "desc" }, include: { actor: true } });
}

export type { SampleAllocationStatus };
