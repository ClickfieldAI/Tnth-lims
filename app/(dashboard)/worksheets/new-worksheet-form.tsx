"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea, Input } from "@/components/ui/forms";
import { createWorksheetAction } from "@/actions/worksheets";

export interface AvailableAllocation {
  id: string;
  sampleCode: string;
  trfCode: string;
  customerName: string;
  requestedParameter: string;
  analystName: string;
  analystId: string;
}

export function NewWorksheetForm({ available }: { available: AvailableAllocation[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createWorksheetAction({ testAllocationIds: selected, notes, dueDate: dueDate || undefined });
      if (!res.ok) return setError(res.error ?? "Failed to create worksheet.");
      router.push(`/worksheets/${res.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Create Worksheet" subtitle="Select one or more allocated tests to group into a worksheet" />
      <CardContent className="space-y-2">
        {available.map((a) => (
          <label key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
              <span className="font-mono text-[11px] text-slate-500">{a.sampleCode}</span> {a.requestedParameter}
            </span>
            <span className="text-xs text-slate-400">{a.customerName} · {a.analystName}</span>
          </label>
        ))}
        {!available.length ? <p className="text-sm text-slate-400">No allocated tests are available to add to a worksheet right now.</p> : null}
      </CardContent>
      <CardContent className="grid gap-3 sm:grid-cols-2 border-t border-[var(--border-soft)]">
        <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Preparation instructions / notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </CardContent>
      {error ? <CardContent className="text-xs font-medium text-rose-600">{error}</CardContent> : null}
      <CardContent className="border-t border-[var(--border-soft)]">
        <Button onClick={submit} disabled={pending || !selected.length}>{pending ? "Creating…" : "Create Worksheet"}</Button>
      </CardContent>
    </Card>
  );
}
