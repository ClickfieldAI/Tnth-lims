import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact editorial page header. Deliberately NOT a big photo hero card —
 * a thumbnail (when `image` is given) sits as a small square badge next to
 * the title instead of dominating the page with empty white space.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  meta,
  image,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  image?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-[var(--border-soft)] pb-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          {image ? (
            <div className="relative hidden h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border-soft)] sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="max-w-2xl">
            {eyebrow ? (
              <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
                <span className="h-px w-4 bg-brand-600" />
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#12151a] sm:text-[32px]">{title}</h1>
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-slate-500">{meta}</div> : null}
            {subtitle ? <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function MetaDot() {
  return <span className="text-slate-300">•</span>;
}
