// Enquiry & Quotation RBAC — mirrors lib/customers/access.ts. Enforced in
// lib/enquiries/service.ts (server-side); the UI only uses it to decide which
// controls to render.
export { CustomerError as EnquiryError } from "@/lib/customers/access";

export type EnquiryCapability = "view" | "create" | "edit" | "close";
export type QuotationCapability = "view" | "create" | "edit" | "approve" | "send" | "recordAcceptance" | "revise" | "history";

export interface Actor {
  id: string;
  role: string;
  clientId?: string | null;
}

const ENQUIRY_MATRIX: Record<string, EnquiryCapability[]> = {
  ADMIN: ["view", "create", "edit", "close"],
  MANAGER: ["view", "create", "edit", "close"],
  QA: ["view"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: ["view"],
};

const QUOTATION_MATRIX: Record<string, QuotationCapability[]> = {
  ADMIN: ["view", "create", "edit", "approve", "send", "recordAcceptance", "revise", "history"],
  MANAGER: ["view", "create", "edit", "send", "recordAcceptance", "revise", "history"], // approval separated below
  QA: ["view", "history"],
  ANALYST: ["view"],
  MICRO: ["view"],
  CLIENT: ["view"],
};

export const canEnquiry = (actor: Pick<Actor, "role">, cap: EnquiryCapability) => (ENQUIRY_MATRIX[actor.role] ?? []).includes(cap);
export const canQuotation = (actor: Pick<Actor, "role">, cap: QuotationCapability) => (QUOTATION_MATRIX[actor.role] ?? []).includes(cap);

/**
 * Separation of duties: a Lab Manager may approve another manager's/analyst's
 * quotation but never one they personally prepared; Admin is exempt (single
 * super-role, matches how ADMIN is treated as the escape hatch everywhere
 * else in this app, e.g. roleHasPermission in lib/roles.ts).
 */
export function canApproveQuotation(actor: Actor, preparedById: string): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "MANAGER") return false;
  return actor.id !== preparedById;
}

export const isClientScoped = (actor: Pick<Actor, "role">) => actor.role === "CLIENT";
