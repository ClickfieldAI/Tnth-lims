// ============================================================
// Role & permission definitions for the LIMS RBAC system.
// ============================================================

export type RoleCode =
  | "ADMIN"
  | "MANAGER"
  | "QA"
  | "ANALYST"
  | "MICRO"
  | "CLIENT";

export interface RoleDef {
  code: RoleCode;
  label: string;
  description: string;
  permissions: string[];
}

// Granular permission codes
export const PERM = {
  dashboardView: "dashboard.view",
  analyticsView: "analytics.view",
  samplesView: "samples.view",
  samplesCreate: "samples.create",
  samplesAssign: "samples.assign",
  samplesManage: "samples.manage",
  testsView: "tests.view",
  testsExecute: "tests.execute",
  testsReview: "tests.review",
  testsApprove: "tests.approve",
  stabilityView: "stability.view",
  stabilityManage: "stability.manage",
  instrumentsView: "instruments.view",
  instrumentsManage: "instruments.manage",
  qaView: "qa.view",
  qaManage: "qa.manage",
  documentsView: "documents.view",
  documentsManage: "documents.manage",
  reportsGenerate: "reports.generate",
  reportsApprove: "reports.approve",
  batchRelease: "batch.release",
  clientsView: "clients.view",
  clientsManage: "clients.manage",
  usersManage: "users.manage",
  auditView: "audit.view",
  invoicesView: "invoices.view",
  invoicePay: "invoice.pay",
};

// Convenience alias so call sites can use PERMISSIONS.bla (kept for brevity)
export const PERMISSIONS = PERM;
export const ROLES: Record<RoleCode, RoleDef> = {
  ADMIN: {
    code: "ADMIN",
    label: "Laboratory Administrator",
    description: "Full system administration, user & permission management, workflow configuration.",
    permissions: Object.values(PERM),
  },
  MANAGER: {
    code: "MANAGER",
    label: "Lab Manager",
    description: "Assigns samples, approves results, monitors turnaround and QA status.",
    permissions: [
      PERM.dashboardView, PERM.analyticsView, PERM.samplesView,
      PERM.samplesAssign, PERM.testsView, PERM.testsReview,
      PERM.stabilityView, PERM.instrumentsView, PERM.qaView,
      PERM.documentsView, PERM.reportsGenerate, PERM.batchRelease,
      PERM.invoicesView, PERM.clientsView,
    ],
  },
  QA: {
    code: "QA",
    label: "Quality Assurance Officer",
    description: "Reviews documentation, approves reports, manages deviations, CAPA & audits.",
    permissions: [
      PERM.dashboardView, PERM.analyticsView, PERM.samplesView,
      PERM.testsView, PERM.testsApprove, PERM.stabilityView,
      PERM.instrumentsView, PERM.qaView, PERM.qaManage,
      PERM.documentsView, PERM.documentsManage, PERM.reportsGenerate,
      PERM.reportsApprove, PERM.batchRelease, PERM.auditView, PERM.clientsView,
    ],
  },
  ANALYST: {
    code: "ANALYST",
    label: "Chemist / Analyst",
    description: "Performs testing, enters observations, uploads instrument outputs, completes worksheets.",
    permissions: [
      PERM.dashboardView, PERM.samplesView, PERM.samplesCreate,
      PERM.testsView, PERM.testsExecute, PERM.stabilityView,
      PERM.instrumentsView, PERM.qaView, PERM.documentsView, PERM.invoicesView,
    ],
  },
  MICRO: {
    code: "MICRO",
    label: "Microbiology Analyst",
    description: "Manages microbial testing workflows, sterility and microbial limit testing.",
    permissions: [
      PERM.dashboardView, PERM.samplesView, PERM.testsView,
      PERM.testsExecute, PERM.stabilityView, PERM.instrumentsView,
      PERM.qaView, PERM.documentsView,
    ],
  },
  CLIENT: {
    code: "CLIENT",
    label: "Client / Pharma Company User",
    description: "Submits samples, tracks testing status, downloads reports and views invoices.",
    permissions: [
      PERM.dashboardView, PERM.samplesCreate, PERM.samplesView,
      PERM.documentsView, PERM.invoicesView, PERM.invoicePay,
    ],
  },
};

export function roleHasPermission(role: RoleCode | undefined, permission: string): boolean {
  if (!role) return false;
  const def = ROLES[role];
  if (!def) return false;
  if (role === "ADMIN") return true;
  return def.permissions.includes(permission);
}

export function roleLabel(role: RoleCode): string {
  return ROLES[role]?.label ?? role;
}

// Status key → display label + badge tone
export const STATUS_META: Record<string, { label: string; tone: string }> = {
  RECEIVED: { label: "Received", tone: "slate" },
  LOGGED: { label: "Logged", tone: "blue" },
  ASSIGNED: { label: "Assigned", tone: "indigo" },
  TESTING: { label: "Testing", tone: "amber" },
  REVIEW: { label: "In Review", tone: "violet" },
  APPROVED: { label: "Approved", tone: "green" },
  RELEASED: { label: "Released", tone: "emerald" },
  ARCHIVED: { label: "Archived", tone: "zinc" },
  PENDING: { label: "Pending", tone: "zinc" },
  PASS: { label: "PASS", tone: "green" },
  FAIL: { label: "FAIL", tone: "red" },
  INCONCLUSIVE: { label: "Inconclusive", tone: "amber" },
  DRAFT: { label: "Draft", tone: "zinc" },
  COMPLETED: { label: "Completed", tone: "emerald" },
  OPEN: { label: "Open", tone: "red" },
  IN_PROGRESS: { label: "In Progress", tone: "amber" },
  CLOSED: { label: "Closed", tone: "green" },
  OBSOLETE: { label: "Obsolete", tone: "zinc" },
  UNDER_REVIEW: { label: "Under Review", tone: "violet" },
  ACTIVE: { label: "Active", tone: "green" },
  SCHEDULED: { label: "Scheduled", tone: "slate" },
  DUE: { label: "Due", tone: "amber" },
  OVERDUE: { label: "Overdue", tone: "red" },
  AVAILABLE: { label: "Available", tone: "green" },
  IN_USE: { label: "In Use", tone: "blue" },
  MAINTENANCE: { label: "Maintenance", tone: "amber" },
  OFFLINE: { label: "Offline", tone: "zinc" },
  VALID: { label: "Valid", tone: "green" },
  EXPIRED: { label: "Expired", tone: "red" },
  SUBMITTED: { label: "Submitted", tone: "blue" },
  IMPACT_REVIEW: { label: "Impact Review", tone: "violet" },
  IMPLEMENTED: { label: "Implemented", tone: "indigo" },
  VERIFIED: { label: "Verified", tone: "emerald" },
  PAID: { label: "Paid", tone: "green" },
  UNPAID: { label: "Unpaid", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "red" },
  // Module 2 — Enquiry & Quotation statuses
  NEW: { label: "New", tone: "blue" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  QUOTATION_IN_PROGRESS: { label: "Quotation In Progress", tone: "amber" },
  QUOTATION_SENT: { label: "Quotation Sent", tone: "indigo" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "amber" },
  SENT: { label: "Sent", tone: "indigo" },
  CUSTOMER_REJECTED: { label: "Customer Rejected", tone: "red" },
  SUPERSEDED: { label: "Superseded", tone: "zinc" },
  // Module 3 — TRF statuses
  ON_HOLD: { label: "On Hold", tone: "amber" },
  // Module 4 — Sample Receipt statuses (RECEIVED/PENDING reuse existing keys above)
  PARTIAL: { label: "Partially Received", tone: "amber" },
  RECEIVED_WITH_DISCREPANCY: { label: "Received (Discrepancy)", tone: "red" },
  // Module 5 — Technical Review statuses (UNDER_REVIEW/ACCEPTED/ON_HOLD/REJECTED reuse existing keys above)
  CLARIFICATION_REQUESTED: { label: "Clarification Requested", tone: "violet" },
  // Module 6 — Sample Registration statuses (REJECTED reused for CANCELLED tone)
  PENDING_REGISTRATION: { label: "Pending Registration", tone: "zinc" },
  REGISTERED: { label: "Registered", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  // Module 7 — Test Allocation
  ALLOCATED: { label: "Allocated", tone: "green" },
  PARTIALLY_ALLOCATED: { label: "Partially Allocated", tone: "amber" },
  // Module 8 — Worksheet Preparation (ASSIGNED reuses the existing key above)
  PREPARED: { label: "Prepared", tone: "blue" },
  // Module 9 — Testing & Result Entry (IN_PROGRESS/COMPLETED reuse existing keys)
  NOT_STARTED: { label: "Not Started", tone: "zinc" },
  // Modules 10-12 — Technical Verification / Draft Report / QA Review
  // (PENDING/VERIFIED/DRAFT/APPROVED reuse existing keys above)
  RETURNED: { label: "Returned", tone: "amber" },
  GENERATED: { label: "Generated", tone: "blue" },
  SENT_FOR_QA: { label: "Sent for QA", tone: "violet" },
  // Module 13 — Authorized Approval & Release (RELEASED/PENDING/RETURNED reuse existing keys)
  // Module 14 — Customer Delivery (PENDING reuses existing key)
  DELIVERED: { label: "Delivered", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  // Module 15 — Retention & Disposal (EXPIRED reuses existing key for DUE_FOR_DISPOSAL styling separately below)
  RETAINED: { label: "Retained", tone: "blue" },
  DUE_FOR_DISPOSAL: { label: "Due for Disposal", tone: "amber" },
  DISPOSED: { label: "Disposed", tone: "zinc" },
  EXTENDED: { label: "Extended", tone: "indigo" },
};