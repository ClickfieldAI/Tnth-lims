// Technical Verification RBAC — mirrors lib/result-entry/access.ts.
export { CustomerError as VerificationError } from "@/lib/customers/access";

export type VerificationCapability = "view" | "verify" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, VerificationCapability[]> = {
  ADMIN: ["view", "verify", "history"],
  MANAGER: ["view", "verify", "history"],
  QA: ["view", "verify", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canVerification = (actor: Pick<Actor, "role">, cap: VerificationCapability) => (MATRIX[actor.role] ?? []).includes(cap);

/** Analyst/Micro see only their own results in the queue (view-only). */
export function scopeToOwnResults(actor: Actor): string | null {
  return ["ANALYST", "MICRO"].includes(actor.role) ? actor.id : null;
}
