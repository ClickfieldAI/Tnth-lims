// Test Allocation RBAC — mirrors lib/registration/access.ts.
export { CustomerError as AllocationError } from "@/lib/customers/access";

export type AllocationCapability = "view" | "allocate" | "reassign" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, AllocationCapability[]> = {
  ADMIN: ["view", "allocate", "reassign", "history"],
  MANAGER: ["view", "allocate", "reassign", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canAllocation = (actor: Pick<Actor, "role">, cap: AllocationCapability) => (MATRIX[actor.role] ?? []).includes(cap);

/** Analyst/Micro only ever see tests allocated to them. */
export function scopeToOwnAllocations(actor: Actor): string | null {
  return ["ANALYST", "MICRO"].includes(actor.role) ? actor.id : null;
}
