"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/forms";
import { allocateTestAction, reassignTestAction } from "@/actions/allocation";
import { ALLOCATION_PRIORITIES, emptyAllocateTestInput, type AllocateTestInput } from "@/lib/allocation/validation";

export interface AnalystOption { id: string; name: string; role: string }
export interface InstrumentOption { id: string; code: string; name: string }

export function AllocateForm({
  trfTestRequestId, mode, initial, analysts, instruments,
}: {
  trfTestRequestId: string; mode: "allocate" | "reassign";
  initial?: AllocateTestInput; analysts: AnalystOption[]; instruments: InstrumentOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AllocateTestInput>(initial ?? emptyAllocateTestInput());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return <Button size="sm" variant={mode === "allocate" ? "primary" : "secondary"} onClick={() => setOpen(true)}>{mode === "allocate" ? "Allocate" : "Reassign"}</Button>;
  }

  function submit() {
    setErrors({}); setFormError(null);
    startTransition(async () => {
      const res = mode === "allocate" ? await allocateTestAction(trfTestRequestId, form) : await reassignTestAction(trfTestRequestId, form);
      if (!res.ok) { setFormError(res.error ?? "Failed."); if (res.fieldErrors) setErrors(res.fieldErrors); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="grid w-full gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:w-[420px]">
      <Field label="Analyst" required>
        <Select value={form.analystId} onChange={(e) => setForm({ ...form, analystId: e.target.value })}>
          <option value="">Select…</option>
          {analysts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
        </Select>
        {errors.analystId ? <p className="mt-1 text-[11px] text-rose-600">{errors.analystId}</p> : null}
      </Field>
      <Field label="Instrument (if required)">
        <Select value={form.instrumentId ?? ""} onChange={(e) => setForm({ ...form, instrumentId: e.target.value })}>
          <option value="">None</option>
          {instruments.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
        </Select>
      </Field>
      <Field label="Priority" required>
        <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          {ALLOCATION_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label="Operational due date" required>
        <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        {errors.dueDate ? <p className="mt-1 text-[11px] text-rose-600">{errors.dueDate}</p> : null}
      </Field>
      {formError ? <p className="text-xs font-medium text-rose-600">{formError}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={submit}>{pending ? "Saving…" : mode === "allocate" ? "Allocate" : "Save reassignment"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
