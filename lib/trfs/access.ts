// TRF RBAC — mirrors lib/customers/access.ts and lib/enquiries/access.ts.
// Enforced server-side in lib/trfs/service.ts; the UI only uses it to decide
// which controls to render.
export { CustomerError as TrfError } from "@/lib/customers/access";

export type TrfCapability = "view" | "create" | "edit" | "submit" | "review" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const TRF_MATRIX: Record<string, TrfCapability[]> = {
  ADMIN: ["view", "create", "edit", "submit", "review", "history"],
  MANAGER: ["view", "create", "edit", "submit", "review", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: ["view", "create", "edit", "submit"],
};

export const canTrf = (actor: Pick<Actor, "role">, cap: TrfCapability) => (TRF_MATRIX[actor.role] ?? []).includes(cap);
export const isClientScoped = (actor: Pick<Actor, "role">) => actor.role === "CLIENT";
