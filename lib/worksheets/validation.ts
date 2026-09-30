// Worksheet Preparation validation — mirrors lib/allocation/validation.ts.
// Pure functions; authoritative enforcement is in lib/worksheets/service.ts.

export const WORKSHEET_STATUSES = ["DRAFT", "PREPARED", "ASSIGNED", "IN_PROGRESS"] as const;
export type WorksheetStatus = (typeof WORKSHEET_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export interface CreateWorksheetInput {
  testAllocationIds: string[];
  analystId?: string; // defaults to the allocations' analyst if omitted; required if they differ
  instrumentId?: string;
  notes?: string;
  dueDate?: string;
}

export function validateCreateWorksheet(input: CreateWorksheetInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.testAllocationIds.length) e.testAllocationIds = "Select at least one allocated test.";
  return e;
}
