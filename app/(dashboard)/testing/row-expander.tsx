"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResultForm, type ExistingResult } from "./result-form";

export function RowExpander({ testAllocationId, existing, canComplete, canCorrect, canEnter }: {
  testAllocationId: string; existing: ExistingResult | null; canComplete: boolean; canCorrect: boolean; canEnter: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canEnter) return <span className="text-xs text-slate-400">View only</span>;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>{open ? "Close" : existing ? "Open" : "Enter Result"}</Button>
      {open ? (
        <div className="mt-2">
          <ResultForm testAllocationId={testAllocationId} existing={existing} canComplete={canComplete} canCorrect={canCorrect} />
        </div>
      ) : null}
    </>
  );
}
