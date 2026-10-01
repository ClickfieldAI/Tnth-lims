// Corrections & Amendments RBAC — mirrors lib/qa-review/access.ts.
export { CustomerError as CorrectionError } from "@/lib/customers/access";

export type CorrectionCapability = "view" | "request" | "decide" | "complete" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

// Corrections require a review decision separate from whoever requested
// them (separation of duties, mirroring Module 10's verification pattern) —
// QA/Manager/Admin decide and complete; Analyst/Micro may only request.
const MATRIX: Record<string, CorrectionCapability[]> = {
  ADMIN: ["view", "request", "decide", "complete", "history"],
  MANAGER: ["view", "request", "decide", "complete", "history"],
  QA: ["view", "request", "decide", "complete", "history"],
  ANALYST: ["view", "request", "history"],
  MICRO: ["view", "request", "history"],
  CLIENT: [], // clients only ever see the corrected RELEASED revision via Module 14 delivery — never this internal queue/history
};

export const canCorrection = (actor: Pick<Actor, "role">, cap: CorrectionCapability) => (MATRIX[actor.role] ?? []).includes(cap);
