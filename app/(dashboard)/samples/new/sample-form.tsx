"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSample } from "@/actions/samples";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { Button } from "@/components/ui/button";

const TEST_OPTIONS = [
  { code: "ASSAY", label: "Drug Assay" },
  { code: "DISSOLUTION", label: "Dissolution" },
  { code: "IMPURITY", label: "Impurity Analysis" },
  { code: "HPLC", label: "HPLC Analysis" },
  { code: "GC", label: "GC Analysis" },
  { code: "MICROBIOLOGY", label: "Microbiology" },
  { code: "STABILITY", label: "Stability" },
];

export function SampleForm({
  clients, products, lockedTest,
}: {
  clients: { id: string; name: string }[];
  products: { id: string; name: string }[];
  lockedTest?: { code: string; label: string } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await createSample(formData);
    if (!res.ok) {
      setError(res.error ?? "Could not register the sample.");
      setPending(false);
      return;
    }
    router.push(`/samples/${res.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Client company" required>
        <Select name="clientId" required defaultValue="">
          <option value="" disabled>Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>

      <Field label="Product">
        <Select name="productHint" defaultValue="">
          <option value="">— not listed (type below) —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </Field>

      <Field label="Product name" required>
        <Input name="productName" placeholder="e.g. Amoxicillin 500 mg Capsules" required />
      </Field>

      <Field label="Batch number">
        <Input name="batchNumber" placeholder="e.g. 2026-AMX-004" />
      </Field>

      <Field label="Manufacturing date">
        <Input type="date" name="mfgDate" />
      </Field>

      <Field label="Expiry date">
        <Input type="date" name="expDate" />
      </Field>

      <Field label="Sample quantity">
        <div className="flex gap-2">
          <Input type="number" step="0.01" min="0" name="quantity" placeholder="20" className="flex-1" />
          <Select name="unit" defaultValue="g" className="w-24">
            {["g", "mg", "mL", "units", "tablets"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label="Storage condition">
        <Select name="storageCondition" defaultValue="15-25°C">
          {["15-25°C", "2-8°C", "-20°C", "25°C / 60% RH", "40°C / 75% RH"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </Field>

      <Field label="Storage location" hint="Shelf / chamber reference for retrieval.">
        <Input name="storageLocation" placeholder="A-01" />
      </Field>

      <Field label="Received date">
        <Input type="date" name="receivedDate" />
      </Field>

      <Field label="Priority level">
        <Select name="priority" defaultValue="NORMAL">
          {["RUSH", "HIGH", "NORMAL", "LOW"].map((p) => (
            <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
          ))}
        </Select>
      </Field>

      <div className="sm:col-span-2">
        <p className="mb-1.5 text-[13px] font-medium text-slate-700">Requested tests <span className="text-red-500">*</span></p>
        {lockedTest ? (
          <div className="flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
            <input type="checkbox" name="requestedTests" value={lockedTest.code} checked readOnly className="h-3.5 w-3.5 accent-brand-600" />
            <input type="hidden" name="serviceLabel" value={lockedTest.label} />
            {lockedTest.label}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {TEST_OPTIONS.map((t) => (
              <label key={t.code} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                <input type="checkbox" name="requestedTests" value={t.code} className="h-3.5 w-3.5 accent-brand-600" />
                {t.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <Field label="Notes">
          <Textarea name="notes" placeholder="Observations on receipt, packaging condition…" />
        </Field>
      </div>

      {error ? <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2 sm:col-span-2">
        <Button disabled={pending}>{pending ? "Registering…" : "Register sample"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/samples")}>Cancel</Button>
      </div>
    </form>
  );
}