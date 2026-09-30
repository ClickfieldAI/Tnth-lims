// Draft COA / Report RBAC — mirrors lib/verification/access.ts.
export { CustomerError as DraftReportError } from "@/lib/customers/access";

export type DraftReportCapability = "view" | "create" | "edit" | "submitForQa" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, DraftReportCapability[]> = {
  ADMIN: ["view", "create", "edit", "submitForQa", "history"],
  MANAGER: ["view", "create", "edit", "submitForQa", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canDraftReport = (actor: Pick<Actor, "role">, cap: DraftReportCapability) => (MATRIX[actor.role] ?? []).includes(cap);
