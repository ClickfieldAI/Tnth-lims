// Sample Registration validation — mirrors lib/reviews/validation.ts. Pure
// functions; authoritative enforcement is in lib/registration/service.ts.

export const REGISTRATION_STATUSES = ["PENDING_REGISTRATION", "REGISTERED", "CANCELLED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  PENDING_REGISTRATION: "Pending Registration",
  REGISTERED: "Registered",
  CANCELLED: "Cancelled",
};

export type FieldErrors = Record<string, string>;

export interface RegisterSampleInput {
  storageCondition: string;
  storageLocation?: string;
  remarks?: string;
}

export function emptyRegisterSampleInput(): RegisterSampleInput {
  return { storageCondition: "Ambient" };
}

export function validateRegisterSample(input: RegisterSampleInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.storageCondition?.trim()) e.storageCondition = "Select a storage condition.";
  return e;
}

export interface StorageUpdateInput {
  storageCondition: string;
  storageLocation?: string;
  remarks?: string;
}

export function validateStorageUpdate(input: StorageUpdateInput): FieldErrors {
  const e: FieldErrors = {};
  if (!input.storageCondition?.trim()) e.storageCondition = "Select a storage condition.";
  return e;
}
