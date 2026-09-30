// Worksheet Preparation RBAC — mirrors lib/allocation/access.ts.
export { CustomerError as WorksheetError } from "@/lib/customers/access";

export type WorksheetCapability = "view" | "create" | "edit" | "assign" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, WorksheetCapability[]> = {
  ADMIN: ["view", "create", "edit", "assign", "history"],
  MANAGER: ["view", "create", "edit", "assign", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canWorksheet = (actor: Pick<Actor, "role">, cap: WorksheetCapability) => (MATRIX[actor.role] ?? []).includes(cap);

export function scopeToOwnWorksheets(actor: Actor): string | null {
  return ["ANALYST", "MICRO"].includes(actor.role) ? actor.id : null;
}
