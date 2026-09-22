"use client";

import React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary:
    "brand-gradient text-white shadow-[var(--shadow-glow)] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-white text-[#2b2a45] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50/60 hover:border-brand-200",
  outline:
    "bg-transparent text-brand-600 border border-brand-200 hover:bg-brand-50",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-900/5",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
  subtle: "bg-slate-900/[0.04] text-slate-700 hover:bg-slate-900/[0.08]",
} as const;

const buttonSizes = {
  sm: "h-8 px-3 text-xs",
  default: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9",
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "default", className = "") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98]",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}
