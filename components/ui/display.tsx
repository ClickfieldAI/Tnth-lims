"use client";

import React from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  indigo: "bg-brand-500/10 text-brand-600",
  blue: "bg-blue-500/10 text-blue-600",
  green: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  violet: "bg-violet-500/10 text-violet-600",
  red: "bg-red-500/10 text-red-600",
  slate: "bg-slate-500/10 text-slate-600",
};

export function StatCard({
  label,
  value,
  sub,
  trend,
  icon,
  tone = "indigo",
}: { label: string; value: React.ReactNode; sub?: string; trend?: "up" | "down"; icon?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-5 shadow-[var(--shadow-xs)] transition-shadow duration-150 hover:shadow-[var(--shadow-sm)]">
      <div className="relative flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon ? <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", tones[tone] ?? tones.indigo)}>{icon}</span> : null}
      </div>
      <p className="relative mt-2 text-2xl font-semibold tracking-tight text-[#14162b]">{value}</p>
      <div className="relative mt-1 flex items-center gap-1.5 text-xs">
        {trend === "up" ? <span className="text-emerald-600">▲</span> : trend === "down" ? <span className="text-red-500">▼</span> : null}
        {sub ? <span className="text-slate-400">{sub}</span> : null}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#14162b]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, className, tone = "indigo" }: { value: number; className?: string; tone?: string }) {
  const tones: Record<string, string> = {
    indigo: "brand-gradient",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
  };
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-slate-900/[0.06]", className)}>
      <div className={cn("h-1.5 rounded-full transition-all duration-300", tones[tone] ?? tones.indigo)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />;
}

export function KpiTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[13px] font-semibold text-slate-700", className)}>{children}</p>;
}
