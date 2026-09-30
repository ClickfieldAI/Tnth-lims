// Technical Verification validation — mirrors lib/result-entry/validation.ts.
export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "RETURNED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export function validateReturnReason(reason: string): FieldErrors {
  const e: FieldErrors = {};
  if (!reason.trim()) e.reason = "A reason is required to return a result for correction.";
  return e;
}
