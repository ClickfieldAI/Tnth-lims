"use client";

import { useEffect } from "react";
import { SplashError } from "@/components/layout/splash";

// Root-level error boundary (Next.js convention) — branded fallback instead
// of an unstyled crash screen or an infinite loading state.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <SplashError onRetry={reset} />;
}
