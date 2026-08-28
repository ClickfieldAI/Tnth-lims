import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { STATUS_META } from "./roles";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCurrency(n: number | null | undefined, currency = "USD"): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(n);
}

export function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: "zinc" };
}

export function initials(first?: string, last?: string): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
}

export function fullName(first?: string, last?: string): string {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function turnAroundDays(received: Date | string | null | undefined, released: Date | string | null | undefined): number | null {
  if (!received) return null;
  const start = typeof received === "string" ? new Date(received) : received;
  const end = released ? (typeof released === "string" ? new Date(released) : released) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

// Read a Json/array field that may be stored as JSON from the DB
export function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

export const TEST_TYPE_LABELS: Record<string, string> = {
  ASSAY: "Drug Assay",
  DISSOLUTION: "Dissolution",
  STABILITY: "Stability",
  IMPURITY: "Impurity Analysis",
  HPLC: "HPLC Analysis",
  GC: "GC Analysis",
  MICROBIOLOGY: "Microbiology",
  ICPMS: "ICP-MS Elemental Analysis",
  HPTLC: "HPTLC Fingerprinting",
  NMR: "NMR Analysis",
  DSC_TGA: "DSC / TGA Thermal Analysis",
  SPF: "SPF / Sunscreen Testing",
  LCMSMS: "LC-MS/MS Trace Analysis",
};

export function testTypeLabel(type: string): string {
  return TEST_TYPE_LABELS[type] ?? type;
}

export function chartColors(start = "#0f9d8f") {
  return {
    teal: "#0f9d8f",
    blue: "#3b82f6",
    indigo: "#6366f1",
    violet: "#8b5cf6",
    amber: "#f59e0b",
    green: "#22c55e",
    red: "#ef4444",
    slate: "#64748b",
  };
}