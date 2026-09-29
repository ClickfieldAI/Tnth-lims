"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/forms";
import { addContactAction, addDocumentAction } from "@/actions/customers";
import { DOC_TYPES } from "@/lib/customers/validation";

export function AddContactForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", designation: "", email: "", phone: "", isPrimary: false });

  if (!open) {
    return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add contact</Button>;
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
      <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      {error ? <p className="col-span-2 text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="col-span-2 flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await addContactAction(customerId, form);
            if (!res.ok) return setError(res.error ?? "Failed");
            setOpen(false);
            setForm({ name: "", designation: "", email: "", phone: "", isPrimary: false });
            router.refresh();
          })}
        >
          {pending ? "Saving…" : "Save contact"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function AddDocumentForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Upload className="h-3.5 w-3.5" /> Upload document</Button>;
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Field label="Document type" required>
        <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="File" required hint="PDF, JPG, PNG or DOCX — up to 10 MB">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" className="text-sm" />
      </Field>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file) return setError("Choose a file to upload.");
            startTransition(async () => {
              const res = await addDocumentAction(customerId, { docType, fileName: file.name, sizeBytes: file.size, mimeType: file.type });
              if (!res.ok) return setError(res.error ?? "Failed");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {pending ? "Uploading…" : "Upload"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
