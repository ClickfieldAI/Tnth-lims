"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCapa } from "@/actions/quality";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";

export function NewCapaButton({ owners }: { owners: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createCapa(formData);
      if (!res.ok) return setError(res.error ?? "Failed");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New CAPA</Button>;
  }

  return (
    <form action={onSubmit} className="grid w-full gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:w-[560px]">
      <p className="text-sm font-semibold text-slate-800">Create CAPA</p>
      <Field label="Title" required>
        <Input name="title" placeholder="e.g. Revise buffer preparation SOP" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <Select name="type" defaultValue="CORRECTIVE">
            <option value="CORRECTIVE">Corrective</option>
            <option value="PREVENTIVE">Preventive</option>
          </Select>
        </Field>
        <Field label="Owner">
          <Select name="ownerId" defaultValue="">
            <option value="">Assign later</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" name="dueDate" />
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" />
      </Field>
      <Field label="Planned action">
        <Input name="action" placeholder="What will be done, by whom?" />
      </Field>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending}>{pending ? "Saving…" : "Create CAPA"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}