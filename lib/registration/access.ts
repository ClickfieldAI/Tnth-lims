// Sample Registration RBAC — mirrors lib/reviews/access.ts. Enforced
// server-side in lib/registration/service.ts; the UI only uses it to decide
// which controls to render.
export { CustomerError as RegistrationError } from "@/lib/customers/access";

export type RegistrationCapability = "view" | "register" | "cancel" | "updateStorage" | "print" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, RegistrationCapability[]> = {
  ADMIN: ["view", "register", "cancel", "updateStorage", "print", "history"],
  MANAGER: ["view", "register", "cancel", "updateStorage", "print", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canRegistration = (actor: Pick<Actor, "role">, cap: RegistrationCapability) => (MATRIX[actor.role] ?? []).includes(cap);
