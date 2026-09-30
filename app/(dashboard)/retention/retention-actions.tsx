"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/forms";
import { extendRetentionAction, disposeSampleAction } from "@/actions/retention";

export function RetentionActions({ id, canExtend, canDispose, disposed }: { id: string; canExtend: boolean; canDispose: boolean; disposed: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "extend" | "dispose">("none");
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disposed) return <span className="text-xs text-slate-400">Disposed</span>;

  if (mode === "none") {
    return (
      <div className="flex gap-2">
        {canExtend ? <Button size="sm" variant="secondary" onClick={() => setMode("extend")}>Extend</Button> : null}
        {canDispose ? <Button size="sm" variant="danger" onClick={() => setMode("dispose")}>Dispose</Button> : null}
        {!canExtend && !canDispose ? <span className="text-xs text-slate-400">View only</span> : null}
      </div>
    );
  }

  if (mode === "extend") {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
        <Field label="New expiry date" required><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></Field>
        <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => startTransition(async () => {
            const res = await extendRetentionAction(id, newDate, reason);
            if (!res.ok) return setError(res.error ?? "Failed.");
            setMode("none"); router.refresh();
          })}>
            {pending ? "Saving…" : "Confirm extension"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
      <Field label="Disposal reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => {
          const res = await disposeSampleAction(id, reason);
          if (!res.ok) return setError(res.error ?? "Failed.");
          setMode("none"); router.refresh();
        })}>
          {pending ? "Saving…" : "Confirm disposal"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
      </div>
    </div>
  );
}
