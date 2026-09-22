import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Hero({
  eyebrow,
  title,
  subtitle,
  image,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  image?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <div className="relative flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div className="relative z-10 max-w-xl">
          {eyebrow ? (
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-600">
              <span className="h-3.5 w-1 rounded-full bg-brand-600" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-[#1a1d1a] sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2.5 text-sm leading-relaxed text-slate-500 sm:text-[15px]">{subtitle}</p> : null}
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {image ? (
          <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl sm:h-48 sm:w-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
