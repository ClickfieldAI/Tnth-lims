// Authorized Approval & Release validation — mirrors lib/qa-review/validation.ts.
export const RELEASE_STATUSES = ["PENDING", "RELEASED", "RETURNED"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export function validateReturnReason(reason: string): FieldErrors {
  const e: FieldErrors = {};
  if (!reason.trim()) e.reason = "A reason is required to reject/return a report.";
  return e;
}
