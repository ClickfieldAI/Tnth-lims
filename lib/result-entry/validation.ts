// Testing & Result Entry validation — mirrors lib/worksheets/validation.ts.
// Pure functions; authoritative enforcement is in lib/result-entry/service.ts.
// (Named result-entry, not testing, to avoid colliding with the existing
// lib/testing.ts used by the legacy pharma testing pages.)

export const RESULT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export interface ResultEntryInput {
  resultValue: string;
  unit?: string;
  referenceValue?: string;
  remarks?: string;
  instrumentUsedId?: string;
  testDate: string;
  isNumeric: boolean; // whether this test/parameter expects a numeric result
}

export function emptyResultEntryInput(isNumeric = false): ResultEntryInput {
  return { resultValue: "", testDate: new Date().toISOString().slice(0, 10), isNumeric };
}

export function validateResultEntry(input: ResultEntryInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.resultValue.trim()) e.resultValue = "Result value is required.";
  else if (input.isNumeric && Number.isNaN(Number(input.resultValue))) e.resultValue = "This test expects a numeric result value.";
  if (!input.testDate) e.testDate = "Test date is required.";
  else if (new Date(input.testDate) > new Date()) e.testDate = "Test date cannot be in the future.";
  return e;
}

export function validateCorrectionReason(reason: string): FieldErrors {
  const e: FieldErrors = {};
  if (!reason.trim()) e.correctionReason = "A reason is required to correct a completed result.";
  return e;
}
