// Technical Review RBAC — mirrors lib/receipts/access.ts. Enforced
// server-side in lib/reviews/service.ts; the UI only uses it to decide which
// controls to render.
export { CustomerError as ReviewError } from "@/lib/customers/access";

export type ReviewCapability = "view" | "assess" | "decide";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

// Technical Review is an internal, QA-relevant lab operation — clients never
// see or act on it, matching Module 4's Sample Receipt.
const MATRIX: Record<string, ReviewCapability[]> = {
  ADMIN: ["view", "assess", "decide"],
  MANAGER: ["view", "assess", "decide"],
  QA: ["view", "assess", "decide"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canReview = (actor: Pick<Actor, "role">, cap: ReviewCapability) => (MATRIX[actor.role] ?? []).includes(cap);
