import type { RoleCode } from "@/lib/roles";
import {
  LayoutDashboard,
  LayoutGrid,
  FlaskConical,
  Microscope,
  Ship,
  Beaker,
  Timer,
  Droplet,
  Activity,
  Bug,
  CalendarClock,
  ClipboardCheck,
  TriangleAlert,
  Wrench,
  GitBranch,
  BookOpenText,
  FileText,
  FolderKanban,
  ReceiptText,
  ClipboardList,
  PackageCheck,
  SearchCheck,
  Tag,
  Building2,
  Settings,
  Bot,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: RoleCode[];
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "All Services", href: "/", icon: LayoutGrid },
      { label: "Overview", href: "/overview", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "QA"] },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Test Request Forms (TRF)", href: "/trfs", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Sample Receipt", href: "/receipts", icon: PackageCheck, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Technical Review", href: "/technical-review", icon: SearchCheck, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Sample Registration", href: "/sample-registration", icon: Tag, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Samples", href: "/samples", icon: FlaskConical, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Instruments", href: "/instruments", icon: Microscope, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Batch Release", href: "/batch-release", icon: Ship, roles: ["ADMIN", "MANAGER", "QA"] },
    ],
  },
  {
    group: "Testing",
    items: [
      { label: "Drug Assay", href: "/testing/assay", icon: Beaker, roles: ["ADMIN", "MANAGER", "QA", "ANALYST"] },
      { label: "Dissolution", href: "/testing/dissolution", icon: Timer, roles: ["ADMIN", "MANAGER", "QA", "ANALYST"] },
      { label: "Impurity", href: "/testing/impurity", icon: Droplet, roles: ["ADMIN", "MANAGER", "QA", "ANALYST"] },
      { label: "HPLC / GC", href: "/testing/hplc-gc", icon: Activity, roles: ["ADMIN", "MANAGER", "QA", "ANALYST"] },
      { label: "Microbiology", href: "/testing/microbiology", icon: Bug, roles: ["ADMIN", "MANAGER", "QA", "MICRO"] },
      { label: "Stability", href: "/testing/stability", icon: CalendarClock, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
    ],
  },
  {
    group: "Quality",
    items: [
      { label: "QA Review", href: "/quality/review", icon: ClipboardCheck, roles: ["ADMIN", "QA"] },
      { label: "Deviations", href: "/quality/deviations", icon: TriangleAlert, roles: ["ADMIN", "QA", "MANAGER"] },
      { label: "CAPA", href: "/quality/capa", icon: Wrench, roles: ["ADMIN", "QA", "MANAGER"] },
      { label: "Change Control", href: "/quality/change-control", icon: GitBranch, roles: ["ADMIN", "QA"] },
      { label: "Audit Trail", href: "/audit-trail", icon: BookOpenText, roles: ["ADMIN", "QA"] },
    ],
  },
  {
    group: "Business",
    items: [
      { label: "Reports", href: "/reports", icon: FileText, roles: ["ADMIN", "MANAGER", "QA", "ANALYST", "MICRO"] },
      { label: "Documents", href: "/documents", icon: FolderKanban, roles: ["ADMIN", "MANAGER", "QA", "ANALYST"] },
      { label: "Customer Master", href: "/clients", icon: Building2, roles: ["ADMIN", "MANAGER", "QA"] },
      { label: "Enquiries & Quotations", href: "/enquiries", icon: ReceiptText, roles: ["ADMIN", "MANAGER", "QA"] },
      { label: "Administration", href: "/admin", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

export function navForRole(role?: RoleCode, isClient = false): NavGroup[] {
  if (isClient) {
    // Client-portal has its own navigation; this is for the back-office shell.
    return [];
  }
  return NAV.map((g) => ({
    group: g.group,
    items: g.items.filter((it) => it.roles === undefined || !role || it.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}