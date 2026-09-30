"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/forms";
import { verifyResultAction, returnResultAction } from "@/actions/verification";

export function VerifyForm({ testResultId, canVerify }: { testResultId: string; canVerify: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"none" | "return">("none");
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canVerify) return <span className="text-xs text-slate-400">View only</span>;
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Review</Button>;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      {mode === "none" ? (
        <>
          <Field label="Reviewer comments"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} /></Field>
          {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              size="sm" variant="success" disabled={pending}
              onClick={() => startTransition(async () => {
                const res = await verifyResultAction(testResultId, comments);
                if (!res.ok) return setError(res.error ?? "Failed.");
                router.refresh();
              })}
            >
              Accept / Verify
            </Button>
            <Button size="sm" variant="danger" onClick={() => setMode("return")}>Return for Correction</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </>
      ) : (
        <>
          <Field label="Return reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
          {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              size="sm" variant="danger" disabled={pending}
              onClick={() => startTransition(async () => {
                const res = await returnResultAction(testResultId, reason);
                if (!res.ok) return setError(res.error ?? "Failed.");
                router.refresh();
              })}
            >
              Confirm Return
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Back</Button>
          </div>
        </>
      )}
    </div>
  );
}
