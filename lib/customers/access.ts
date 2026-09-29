// Customer Master RBAC. Pure — enforced by the service layer (server-side),
// and reused by the UI only to decide which controls to render.

export type Capability = "view" | "create" | "edit" | "status" | "history" | "documents";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, Capability[]> = {
  ADMIN: ["view", "create", "edit", "status", "history", "documents"],
  MANAGER: ["view", "create", "edit", "status", "history", "documents"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: ["view"],
};

export const can = (actor: Pick<Actor, "role">, cap: Capability) => (MATRIX[actor.role] ?? []).includes(cap);

/** Roles that only see customers tied to their own scope (rows filtered in the service). */
export const isScoped = (actor: Pick<Actor, "role">) => ["ANALYST", "MICRO", "CLIENT"].includes(actor.role);

export class CustomerError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "DUPLICATE" | "CONFLICT", message: string, public details?: unknown) {
    super(message);
  }
}
