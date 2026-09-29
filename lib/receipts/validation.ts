// Sample Receipt validation — mirrors lib/trfs/validation.ts. Pure functions;
// authoritative enforcement is in lib/receipts/service.ts.

export const CONTAINER_CONDITIONS = ["Intact", "Damaged", "Other"] as const;
export const SEAL_CONDITIONS = ["Intact", "Broken", "Not Sealed", "Other"] as const;
export const DISCREPANCY_TYPES = [
  "Quantity Mismatch", "Damaged Packaging", "Broken Seal", "Missing Sample", "Other",
] as const;

export const TRF_RECEIPT_STATUSES = ["PENDING", "PARTIAL", "RECEIVED", "RECEIVED_WITH_DISCREPANCY"] as const;
export type TrfReceiptStatus = (typeof TRF_RECEIPT_STATUSES)[number];

export const TRF_RECEIPT_STATUS_LABEL: Record<TrfReceiptStatus, string> = {
  PENDING: "Pending Receipt",
  PARTIAL: "Partially Received",
  RECEIVED: "Received",
  RECEIVED_WITH_DISCREPANCY: "Received (Discrepancy)",
};

export type FieldErrors = Record<string, string>;

export interface SampleReceiptInput {
  receivedDate: string; // yyyy-mm-dd (+ optional time via receivedTime)
  receivedTime?: string;
  receivedQuantity: number;
  receivedQuantityUnit: string;
  containerCondition: string;
  sealCondition: string;
  temperature?: string;
  storageCondition: string;
  storageLocation?: string;
  remarks?: string;
  hasDiscrepancy: boolean;
  discrepancyTypes: string[];
  discrepancyRemarks?: string;
}

export function emptySampleReceiptInput(): SampleReceiptInput {
  return {
    receivedDate: new Date().toISOString().slice(0, 10),
    receivedQuantity: 0, receivedQuantityUnit: "",
    containerCondition: "Intact", sealCondition: "Intact",
    storageCondition: "Ambient", hasDiscrepancy: false, discrepancyTypes: [],
  };
}

export function validateSampleReceipt(input: SampleReceiptInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.receivedDate) e.receivedDate = "Received date is required.";
  else if (new Date(input.receivedDate) > new Date()) e.receivedDate = "Received date cannot be in the future.";
  if (input.receivedQuantity === undefined || input.receivedQuantity === null || input.receivedQuantity < 0) {
    e.receivedQuantity = "Received quantity must be zero or a positive value.";
  }
  if (!input.receivedQuantityUnit?.trim()) e.receivedQuantityUnit = "Quantity unit is required.";
  if (!(CONTAINER_CONDITIONS as readonly string[]).includes(input.containerCondition)) e.containerCondition = "Select a container condition.";
  if (!(SEAL_CONDITIONS as readonly string[]).includes(input.sealCondition)) e.sealCondition = "Select a seal condition.";
  if (!input.storageCondition) e.storageCondition = "Select a storage condition.";

  if (input.hasDiscrepancy) {
    if (!input.discrepancyTypes.length) e.discrepancyTypes = "Select at least one discrepancy type.";
    if (!input.discrepancyRemarks?.trim()) e.discrepancyRemarks = "Remarks are required when a discrepancy is recorded.";
  }
  return e;
}
