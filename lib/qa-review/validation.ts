// QA Review validation — mirrors lib/reports/validation.ts.
export const QA_REVIEW_STATUSES = ["PENDING", "APPROVED", "RETURNED"] as const;
export type QaReviewStatus = (typeof QA_REVIEW_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export function validateReturnReason(reason: string): FieldErrors {
  const e: FieldErrors = {};
  if (!reason.trim()) e.reason = "A reason is required to return a report to the preparer.";
  return e;
}
