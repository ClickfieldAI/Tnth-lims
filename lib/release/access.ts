// Authorized Approval & Release RBAC — mirrors lib/qa-review/access.ts.
export { CustomerError as ReleaseError } from "@/lib/customers/access";

export type ReleaseCapability = "view" | "release" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

// Release is the final authorization gate before a customer can ever see a
// report — restricted to Admin/Manager ("authorized management roles").
const MATRIX: Record<string, ReleaseCapability[]> = {
  ADMIN: ["view", "release", "history"],
  MANAGER: ["view", "release", "history"],
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [], // clients only ever see a report after release, via Module 14 delivery — never this internal queue
};

export const canRelease = (actor: Pick<Actor, "role">, cap: ReleaseCapability) => (MATRIX[actor.role] ?? []).includes(cap);
