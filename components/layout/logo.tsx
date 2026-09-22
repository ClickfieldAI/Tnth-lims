import { cn } from "@/lib/utils";

// Canonical TNTH brand mark — the same PNG asset (extracted from the official
// Tamilnadu Test House report template) backs the navbar, login page, client
// portal header, and the PDF report generator (see lib/tnth-logo.ts for the
// base64 copy jsPDF needs). Keep this the single place the UI references it.
export function TnthLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/tnth-logo.png"
      alt="Tamilnadu Test House Private Limited"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
