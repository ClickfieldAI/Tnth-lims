"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Hero } from "@/components/layout/hero";

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
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-5 shadow-[var(--shadow-xs)] transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]">
      <div className="relative flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon ? <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", tones[tone] ?? tones.indigo)}>{icon}</span> : null}
      </div>
      <p className="relative mt-2 text-2xl font-semibold tracking-tight text-[#1a1d1a]">{value}</p>
      <div className="relative mt-1 flex items-center gap-1.5 text-xs">
        {trend === "up" ? <span className="text-emerald-600">▲</span> : trend === "down" ? <span className="text-red-500">▼</span> : null}
        {sub ? <span className="text-slate-400">{sub}</span> : null}
      </div>
    </div>
  );
}

// PageHeader is a thin alias over the shared `Hero` banner component — every
// module (Operations, Testing, Quality, Business, Services) renders its
// category/title/description/image/action through this ONE implementation,
// so the image is always a full header visual (never a title-side icon) and
// every module gets layout fixes automatically.
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  image,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  image?: string;
}) {
  return <Hero eyebrow={eyebrow} title={title} subtitle={description} image={image} actions={actions} />;
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
