// Sample Receipt RBAC — mirrors lib/trfs/access.ts. Enforced server-side in
// lib/receipts/service.ts; the UI only uses it to decide which controls to
// render.
export { CustomerError as ReceiptError } from "@/lib/customers/access";

export type ReceiptCapability = "view" | "record" | "confirm" | "reviewDiscrepancy";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

// Receipt is an internal lab operation — clients never see or act on it.
const MATRIX: Record<string, ReceiptCapability[]> = {
  ADMIN: ["view", "record", "confirm", "reviewDiscrepancy"],
  MANAGER: ["view", "record", "confirm", "reviewDiscrepancy"],
  QA: ["view", "reviewDiscrepancy"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: [],
};

export const canReceipt = (actor: Pick<Actor, "role">, cap: ReceiptCapability) => (MATRIX[actor.role] ?? []).includes(cap);
