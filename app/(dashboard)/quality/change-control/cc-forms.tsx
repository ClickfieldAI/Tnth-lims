"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createChangeControl, decideChangeControl } from "@/actions/quality";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";

export function NewChangeControlButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createChangeControl(formData);
      if (!res.ok) return setError(res.error ?? "Failed");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Raise change request</Button>;
  }

  return (
    <form action={onSubmit} className="grid w-full gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:w-[560px]">
      <p className="text-sm font-semibold text-slate-800">Raise change control</p>
      <Field label="Title" required>
        <Input name="title" placeholder="e.g. Replace HPLC column supplier" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select name="category" defaultValue="METHOD">
            {["METHOD", "PROCESS", "EQUIPMENT", "SOFTWARE", "FACILITY"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Assessed risk">
          <Select name="risk" defaultValue="low">
            {["low", "medium", "high"].map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" />
      </Field>
      <Field label="Justification">
        <Input name="justification" placeholder="Why is the change needed?" />
      </Field>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function DecideButtons({ ccId }: { ccId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await decideChangeControl(ccId, decision);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="success" disabled={pending} onClick={() => decide("APPROVED")}>Approve</Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => decide("REJECTED")}>Reject</Button>
    </div>
  );
}