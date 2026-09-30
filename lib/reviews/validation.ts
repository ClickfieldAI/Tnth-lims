// Technical Review validation — mirrors lib/receipts/validation.ts. Pure
// functions; authoritative enforcement is in lib/reviews/service.ts.

export const REVIEW_STATUSES = ["PENDING", "UNDER_REVIEW", "ACCEPTED", "ON_HOLD", "REJECTED", "CLARIFICATION_REQUESTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Pending Review",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  ON_HOLD: "On Hold",
  REJECTED: "Rejected",
  CLARIFICATION_REQUESTED: "Clarification Requested",
};

export const CONDITION_RATING = ["Satisfactory", "Unsatisfactory", "Not Assessed"] as const;

export type FieldErrors = Record<string, string>;

export interface TechnicalAssessmentInput {
  labelingSatisfactory: string; // CONDITION_RATING
  quantitySufficient: string;
  packagingSatisfactory: string;
  sampleConditionSatisfactory: string;
  testRequestComplete: string;
  assessmentNotes?: string;
}

export function emptyAssessmentInput(): TechnicalAssessmentInput {
  return {
    labelingSatisfactory: "Not Assessed", quantitySufficient: "Not Assessed",
    packagingSatisfactory: "Not Assessed", sampleConditionSatisfactory: "Not Assessed",
    testRequestComplete: "Not Assessed",
  };
}

export function validateAssessment(input: TechnicalAssessmentInput): FieldErrors {
  const e: FieldErrors = {};
  const fields: (keyof TechnicalAssessmentInput)[] = ["labelingSatisfactory", "quantitySufficient", "packagingSatisfactory", "sampleConditionSatisfactory", "testRequestComplete"];
  for (const f of fields) {
    if (!(CONDITION_RATING as readonly string[]).includes(input[f] as string)) e[f] = "Select a rating.";
  }
  return e;
}

/** A decision can only be made once every assessment field has an actual
 * (non-"Not Assessed") rating — the reviewer must have looked at each item. */
export function assessmentComplete(input: TechnicalAssessmentInput): boolean {
  return [input.labelingSatisfactory, input.quantitySufficient, input.packagingSatisfactory, input.sampleConditionSatisfactory, input.testRequestComplete]
    .every((v) => v !== "Not Assessed");
}
