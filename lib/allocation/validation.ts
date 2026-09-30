// Test Allocation validation — mirrors lib/registration/validation.ts.
// Pure functions; authoritative enforcement is in lib/allocation/service.ts.

export const ALLOCATION_PRIORITIES = ["Normal", "High", "Rush"] as const;

// Per-test status (shown in the queue table).
export const ALLOCATION_STATUSES = ["PENDING", "ALLOCATED"] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

// Sample-level rollup (shown in the summary cards), mirroring the receipt
// module's PENDING/PARTIAL/RECEIVED pattern.
export const SAMPLE_ALLOCATION_STATUSES = ["PENDING", "PARTIALLY_ALLOCATED", "ALLOCATED"] as const;
export type SampleAllocationStatus = (typeof SAMPLE_ALLOCATION_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export interface AllocateTestInput {
  analystId: string;
  instrumentId?: string;
  priority: string;
  dueDate: string;
}

export function emptyAllocateTestInput(): AllocateTestInput {
  return { analystId: "", priority: "Normal", dueDate: "" };
}

export function validateAllocateTest(input: AllocateTestInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.analystId) e.analystId = "Select an analyst.";
  if (!(ALLOCATION_PRIORITIES as readonly string[]).includes(input.priority)) e.priority = "Select a priority.";
  if (!input.dueDate) e.dueDate = "Operational due date is required.";
  return e;
}
