"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/forms";
import {
  startTrfReviewAction, acceptTrfAction, holdTrfAction, resumeTrfReviewAction, rejectTrfAction, requestTrfClarificationAction,
} from "@/actions/trfs";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Failed");
      router.refresh();
      after?.();
    });
  }
  return { pending, error, run };
}

export function TrfReviewActions({ id, status }: { id: string; status: string }) {
  const { pending, error, run } = useAction();
  const [dialog, setDialog] = useState<"none" | "hold" | "reject" | "clarify">("none");
  const [text, setText] = useState("");

  if (status === "SUBMITTED") {
    return (
      <div>
        <Button size="sm" onClick={() => run(() => startTrfReviewAction(id))} disabled={pending}>{pending ? "Starting…" : "Start Technical Review"}</Button>
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </div>
    );
  }

  if (status === "ON_HOLD") {
    return (
      <div>
        <Button size="sm" onClick={() => run(() => resumeTrfReviewAction(id))} disabled={pending}>{pending ? "Resuming…" : "Resume Review"}</Button>
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </div>
    );
  }

  if (status !== "UNDER_REVIEW") return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="success" onClick={() => run(() => acceptTrfAction(id))} disabled={pending}>Accept TRF</Button>
        <Button size="sm" variant="secondary" onClick={() => setDialog("clarify")}>Request Clarification</Button>
        <Button size="sm" variant="outline" onClick={() => setDialog("hold")}>Place On Hold</Button>
        <Button size="sm" variant="danger" onClick={() => setDialog("reject")}>Reject</Button>
      </div>
      {dialog !== "none" ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <Field label={dialog === "hold" ? "Hold reason" : dialog === "reject" ? "Rejection reason" : "Clarification comment"} required>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={dialog === "reject" ? "danger" : "primary"}
              disabled={pending}
              onClick={() => run(
                () => dialog === "hold" ? holdTrfAction(id, text) : dialog === "reject" ? rejectTrfAction(id, text) : requestTrfClarificationAction(id, text),
                () => { setDialog("none"); setText(""); },
              )}
            >
              {pending ? "Saving…" : "Confirm"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog("none")}>Cancel</Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
