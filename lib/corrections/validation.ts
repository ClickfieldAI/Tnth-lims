// Corrections & Amendments validation — mirrors lib/retention/validation.ts.
export const CORRECTION_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export interface RequestCorrectionInput {
  draftReportId: string;
  description: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
}

export function validateRequestCorrection(input: RequestCorrectionInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.description?.trim()) e.description = "A description of what is being corrected is required.";
  if (!input.originalValue?.trim()) e.originalValue = "The original value must be preserved — it cannot be blank.";
  if (!input.correctedValue?.trim()) e.correctedValue = "A corrected value is required.";
  if (!input.reason?.trim()) e.reason = "A reason is required for every correction request.";
  return e;
}

export function validateDecisionReason(reason: string): FieldErrors {
  const e: FieldErrors = {};
  if (!reason.trim()) e.reason = "A reason is required.";
  return e;
}
