// Retention & Disposal RBAC — mirrors lib/release/access.ts.
export { CustomerError as RetentionError } from "@/lib/customers/access";

export type RetentionCapability = "view" | "extend" | "dispose" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, RetentionCapability[]> = {
  ADMIN: ["view", "extend", "dispose", "history"],
  MANAGER: ["view", "extend", "dispose", "history"],
  QA: ["view", "extend", "history"], // QA can approve an extension but disposal stays Admin/Manager
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [], // no internal disposal controls for clients
};

export const canRetention = (actor: Pick<Actor, "role">, cap: RetentionCapability) => (MATRIX[actor.role] ?? []).includes(cap);
