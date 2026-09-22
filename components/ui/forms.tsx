"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[13px] font-medium text-slate-700", className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-300 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[70px] w-full rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-300",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-[var(--border-soft)] bg-white px-3 text-sm text-slate-900 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-300",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <Label>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Avatar({ initials, className, name }: { initials?: string; className?: string; name?: string }) {
  return (
    <div
      className={cn("flex h-9 w-9 items-center justify-center rounded-full brand-gradient text-xs font-semibold text-white shadow-[var(--shadow-xs)]", className)}
      title={name}
    >
      {initials}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("border-t border-[var(--border-soft)]", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-[var(--surface-muted)] px-6 py-12 text-center">
      {icon ? <div className="text-slate-400">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description ? <p className="text-xs text-slate-500 max-w-md">{description}</p> : null}
      {action}
    </div>
  );
}
