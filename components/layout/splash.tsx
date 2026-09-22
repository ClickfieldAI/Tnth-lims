import { TnthLogo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

// Branded startup screen — the first thing shown on a cold load of any route
// (App Router uses this as the Suspense fallback for the root segment while
// the server checks the session / redirects). Kept intentionally minimal:
// logo, product name, a subtle status line, no motion beyond a soft fade-in.
export function Splash({ message = "Loading" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--background)] px-4">
      <div className="animate-tnth-fade-in flex flex-col items-center gap-4">
        <TnthLogo className="h-20 w-20 sm:h-24 sm:w-24" />
        <p className="text-lg font-bold tracking-tight text-[#12151a] sm:text-xl">TNTH LIMS</p>
      </div>
      <div className="animate-tnth-fade-in flex items-center gap-2 text-[13px] font-medium text-slate-500" style={{ animationDelay: "150ms", animationFillMode: "backwards" }}>
        <span>{message}</span>
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-tnth-dot rounded-full bg-brand-600"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export function SplashError({
  title = "Unable to load TNTH LIMS",
  description = "Please refresh the page and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--background)] px-4", className)}>
      <div className="flex flex-col items-center gap-4">
        <TnthLogo className="h-20 w-20 opacity-90 sm:h-24 sm:w-24" />
        <p className="text-lg font-bold tracking-tight text-[#12151a] sm:text-xl">TNTH LIMS</p>
      </div>
      <div className="flex max-w-sm flex-col items-center gap-1 text-center">
        <p className="text-sm font-semibold text-[#12151a]">{title}</p>
        <p className="text-[13px] text-slate-500">{description}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
      >
        Refresh
      </button>
    </div>
  );
}
