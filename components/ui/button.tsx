"use client";

import React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary:
    "bg-brand-700 text-white shadow-[var(--shadow-xs)] hover:bg-brand-800 active:bg-brand-900",
  secondary:
    "bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300",
  outline:
    "bg-transparent text-brand-700 border border-brand-300 hover:bg-brand-50",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-900/5",
  danger: "bg-rose-700 text-white shadow-sm hover:bg-rose-800",
  success: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
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
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}
