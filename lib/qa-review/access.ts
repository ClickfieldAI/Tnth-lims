// QA Review RBAC — mirrors lib/reports/access.ts.
export { CustomerError as QaReviewError } from "@/lib/customers/access";

export type QaReviewCapability = "view" | "decide" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const MATRIX: Record<string, QaReviewCapability[]> = {
  ADMIN: ["view", "decide", "history"],
  MANAGER: ["view", "decide", "history"],
  QA: ["view", "decide", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canQaReview = (actor: Pick<Actor, "role">, cap: QaReviewCapability) => (MATRIX[actor.role] ?? []).includes(cap);
