"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/forms";

export function NewDocumentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createDocument(formData);
      if (!res.ok) return setError(res.error ?? "Failed");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Register document</Button>;
  }

  return (
    <form action={onSubmit} className="grid w-full gap-3 rounded-lg border border-[var(--border-soft)] bg-white p-4 shadow-sm sm:w-[520px]">
      <p className="text-sm font-semibold text-slate-800">Register controlled document</p>
      <Field label="Title" required>
        <Input name="title" placeholder="e.g. SOP-014 HPLC Column Qualification" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select name="category" defaultValue="SOP">
            {["SOP", "TEST_METHOD", "COA", "VALIDATION", "CALIBRATION_CERTIFICATE", "POLICY"].map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Version">
          <Input name="version" defaultValue="1.0" />
        </Field>
      </div>
      <Field label="File reference / path" hint="Storage path or reference — file upload is not yet wired up.">
        <Input name="filePath" placeholder="/controlled-docs/SOP-014-v1.0.pdf" />
      </Field>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending}>{pending ? "Submitting…" : "Register as draft"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
