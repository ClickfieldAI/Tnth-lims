import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Large banner header used on landing/overview pages (service hub, division
 * pages, main dashboard) — a rounded card with an eyebrow, big title and an
 * optional photo bleeding in from the right, mirroring the reference ERP's
 * "what can we manage for you" style module banners.
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
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white",
        className,
      )}
    >
      <div className="relative z-10 flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div className="max-w-lg">
          {eyebrow ? (
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
              <span className="h-px w-5 bg-brand-600" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#12151a] sm:text-[32px]">{title}</h1>
          {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-slate-500">{meta}</div> : null}
          {subtitle ? <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500 sm:text-[15px]">{subtitle}</p> : null}
          {actions ? <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {image ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] sm:block">
          <Image src={image} alt="" fill sizes="500px" className="object-cover" priority={false} />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
        </div>
      ) : null}
    </div>
  );
}

export function MetaDot() {
  return <span className="text-slate-300">•</span>;
}
