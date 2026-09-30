// Testing & Result Entry RBAC — mirrors lib/worksheets/access.ts.
export { CustomerError as ResultEntryError } from "@/lib/customers/access";

export type ResultEntryCapability = "view" | "enter" | "complete" | "correct";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, ResultEntryCapability[]> = {
  ADMIN: ["view", "enter", "complete", "correct"],
  MANAGER: ["view", "enter", "complete", "correct"],
  QA: ["view"],
  ANALYST: ["view", "enter", "complete"],
  MICRO: ["view", "enter", "complete"],
  CLIENT: [],
};

export const canResultEntry = (actor: Pick<Actor, "role">, cap: ResultEntryCapability) => (MATRIX[actor.role] ?? []).includes(cap);

export function scopeToOwnTests(actor: Actor): string | null {
  return ["ANALYST", "MICRO"].includes(actor.role) ? actor.id : null;
}
