"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/roles";

const tones: Record<string, string> = {
  zinc: "bg-zinc-100 text-zinc-700",
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  indigo: "bg-indigo-50 text-indigo-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-green-50 text-green-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  rose: "bg-rose-50 text-rose-700",
};

export function Badge({ className, tone = "zinc", children }: { className?: string; tone?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", tones[tone] ?? tones.zinc, className)}>
      {children}
    </span>
  );
}

const dots: Record<string, string> = {
  zinc: "bg-zinc-400",
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  rose: "bg-rose-500",
};

export function StatusBadge({ status, dot = false, className }: { status: string; dot?: boolean; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "zinc" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", tones[meta.tone] ?? tones.zinc, className)}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dots[meta.tone] ?? dots.zinc)} /> : null}
      {meta.label}
    </span>
  );
}