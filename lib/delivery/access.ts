// Customer Delivery RBAC — mirrors lib/release/access.ts.
export { CustomerError as DeliveryError } from "@/lib/customers/access";

export type DeliveryCapability = "view" | "manage" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, DeliveryCapability[]> = {
  ADMIN: ["view", "manage", "history"],
  MANAGER: ["view", "manage", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  // Clients never manage delivery — they only ever see their own delivered
  // reports, scoped in the service layer, never the internal queue at large.
  CLIENT: ["view"],
};

export const canDelivery = (actor: Pick<Actor, "role">, cap: DeliveryCapability) => (MATRIX[actor.role] ?? []).includes(cap);

export function scopeToOwnCustomer(actor: Actor): string | null {
  return actor.role === "CLIENT" ? (actor.clientId ?? "__none__") : null;
}
