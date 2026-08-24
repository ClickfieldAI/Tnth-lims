"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientSample } from "@/actions/client-portal";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { Button } from "@/components/ui/button";

const TESTS = [
  "ASSAY", "DISSOLUTION", "IMPURITY", "HPLC", "GC", "MICROBIOLOGY", "STABILITY",
];

export function ClientSampleForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createClientSample(formData);
      if (!res.ok) return setError(res.error ?? "Submission failed");
      router.push("/client/samples");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Product name" required>
        <Input name="productName" placeholder="e.g. Paracetamol 650 mg Tablets" required />
      </Field>
      <Field label="Batch number">
        <Input name="batchNumber" placeholder="e.g. 2026-PRC-002" />
      </Field>
      <Field label="Manufacturing date">
        <Input type="date" name="mfgDate" />
      </Field>
      <Field label="Expiry date">
        <Input type="date" name="expDate" />
      </Field>
      <Field label="Quantity submitted">
        <div className="flex gap-2">
          <Input type="number" step="0.01" min="0" name="quantity" className="flex-1" />
          <Select name="unit" defaultValue="g" className="w-24">
            {["g", "mg", "mL", "units"].map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </div>
      </Field>
      <Field label="Storage condition on arrival">
        <Select name="storageCondition" defaultValue="15-25°C">
          {["15-25°C", "2-8°C", "-20°C"].map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>

      <div className="sm:col-span-2">
        <p className="mb-1.5 text-[13px] font-medium text-slate-700">Requested tests <span className="text-red-500">*</span></p>
        <div className="grid gap-2 sm:grid-cols-3">
          {TESTS.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs capitalize text-slate-700 hover:bg-slate-50">
              <input type="checkbox" name="requestedTests" value={t} className="h-3.5 w-3.5 accent-indigo-600" />
              {t.toLowerCase()}
            </label>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <Field label="Notes for the laboratory">
          <Textarea name="notes" placeholder="Handling instructions, regulatory context…" />
        </Field>
      </div>

      {error ? <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p> : null}

      <div className="sm:col-span-2">
        <Button disabled={pending}>{pending ? "Submitting…" : "Submit sample for testing"}</Button>
      </div>
    </form>
  );
}