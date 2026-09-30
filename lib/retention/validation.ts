// Retention & Disposal validation — mirrors lib/release/validation.ts.
export const RETENTION_STATUSES = ["RETAINED", "DUE_FOR_DISPOSAL", "DISPOSED", "EXTENDED"] as const;
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

// Default retention period applied when a sample enters retention on report
// release — no retention-period configuration exists elsewhere in this app,
// so a simple, documented default is used rather than inventing per-test
// regulatory retention rules.
export const DEFAULT_RETENTION_DAYS = 90;

export type FieldErrors = Record<string, string>;

export function validateExtension(newExpiryDate: string, currentExpiryDate: Date): FieldErrors {
  const e: FieldErrors = {};
  if (!newExpiryDate) e.newExpiryDate = "A new retention expiry date is required.";
  else if (new Date(newExpiryDate) <= currentExpiryDate) e.newExpiryDate = "The new expiry date must be later than the current one.";
  return e;
}

export function validateDisposalReason(reason: string): FieldErrors {
  const e: FieldErrors = {};
  if (!reason.trim()) e.reason = "A disposal reason is required.";
  return e;
}
