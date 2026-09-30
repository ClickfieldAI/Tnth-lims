"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/forms";
import { saveResultAction, completeResultAction, correctResultAction } from "@/actions/result-entry";
import { emptyResultEntryInput, type ResultEntryInput } from "@/lib/result-entry/validation";

export interface ExistingResult {
  resultValue: string; unit?: string; referenceValue?: string; remarks?: string; testDate: string; status: string;
}

export function ResultForm({ testAllocationId, existing, canComplete, canCorrect }: {
  testAllocationId: string; existing: ExistingResult | null; canComplete: boolean; canCorrect: boolean;
}) {
  const router = useRouter();
  const isCompleted = existing?.status === "COMPLETED";
  const [editingCompleted, setEditingCompleted] = useState(false);
  const [form, setForm] = useState<ResultEntryInput>(
    existing ? { ...emptyResultEntryInput(), resultValue: existing.resultValue, unit: existing.unit, referenceValue: existing.referenceValue, remarks: existing.remarks, testDate: existing.testDate }
      : emptyResultEntryInput(),
  );
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setErrors({}); setFormError(null);
    startTransition(async () => {
      const res = editingCompleted
        ? await correctResultAction(testAllocationId, form, reason)
        : await saveResultAction(testAllocationId, form);
      if (!res.ok) { setFormError(res.error ?? "Failed."); if (res.fieldErrors) setErrors(res.fieldErrors); return; }
      setEditingCompleted(false);
      router.refresh();
    });
  }

  function complete() {
    startTransition(async () => {
      const res = await completeResultAction(testAllocationId);
      if (!res.ok) return setFormError(res.error ?? "Failed.");
      router.refresh();
    });
  }

  const readOnly = isCompleted && !editingCompleted;

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
      <Field label="Result value" required>
        <Input value={form.resultValue} disabled={readOnly} onChange={(e) => setForm({ ...form, resultValue: e.target.value })} />
        {errors.resultValue ? <p className="mt-1 text-[11px] text-rose-600">{errors.resultValue}</p> : null}
      </Field>
      <Field label="Unit"><Input value={form.unit ?? ""} disabled={readOnly} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
      <Field label="Reference / specification value"><Input value={form.referenceValue ?? ""} disabled={readOnly} onChange={(e) => setForm({ ...form, referenceValue: e.target.value })} /></Field>
      <Field label="Test date" required>
        <Input type="date" value={form.testDate} disabled={readOnly} onChange={(e) => setForm({ ...form, testDate: e.target.value })} />
        {errors.testDate ? <p className="mt-1 text-[11px] text-rose-600">{errors.testDate}</p> : null}
      </Field>
      <Field label="Remarks" hint="Sample-specific observations"><Textarea value={form.remarks ?? ""} disabled={readOnly} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>

      {editingCompleted ? (
        <Field label="Correction reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          {errors.correctionReason ? <p className="mt-1 text-[11px] text-rose-600">{errors.correctionReason}</p> : null}
        </Field>
      ) : null}

      {formError ? <p className="text-xs font-medium text-rose-600 sm:col-span-2">{formError}</p> : null}

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        {!isCompleted ? (
          <>
            <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save Result"}</Button>
            {canComplete && existing ? <Button size="sm" variant="success" onClick={complete} disabled={pending}>Mark Complete</Button> : null}
          </>
        ) : editingCompleted ? (
          <>
            <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save Correction"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingCompleted(false)}>Cancel</Button>
          </>
        ) : (
          canCorrect ? <Button size="sm" variant="outline" onClick={() => setEditingCompleted(true)}>Correct Result</Button> : null
        )}
      </div>
    </div>
  );
}
