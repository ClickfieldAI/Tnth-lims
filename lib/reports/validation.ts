// Draft COA / Report validation — mirrors lib/verification/validation.ts.
export const DRAFT_REPORT_STATUSES = ["DRAFT", "GENERATED", "SENT_FOR_QA"] as const;
export type DraftReportStatus = (typeof DRAFT_REPORT_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export interface CreateDraftReportInput {
  sampleRegistrationId: string;
  testResultIds: string[]; // must all be VERIFIED and belong to this sample
}

export function validateCreateDraftReport(input: CreateDraftReportInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.sampleRegistrationId) e.sampleRegistrationId = "Select a registered sample.";
  if (!input.testResultIds.length) e.testResultIds = "Select at least one verified result to include.";
  return e;
}
