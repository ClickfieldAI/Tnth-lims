// Customer Delivery validation — mirrors lib/release/validation.ts.
export const DELIVERY_METHODS = ["EMAIL", "PORTAL", "MANUAL"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const DELIVERY_STATUSES = ["PENDING", "DELIVERED", "FAILED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type FieldErrors = Record<string, string>;

export interface CreateDeliveryInput {
  deliveryMethod: string;
  recipient: string;
  notes?: string;
}

export function validateCreateDelivery(input: CreateDeliveryInput): FieldErrors {
  const e: FieldErrors = {};
  if (!(DELIVERY_METHODS as readonly string[]).includes(input.deliveryMethod)) e.deliveryMethod = "Select a delivery method.";
  if (!input.recipient.trim()) e.recipient = "A recipient is required.";
  return e;
}
