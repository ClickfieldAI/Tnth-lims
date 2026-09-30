"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { registerSampleAction } from "@/actions/registration";
import { emptyRegisterSampleInput, type RegisterSampleInput } from "@/lib/registration/validation";
import { STORAGE_CONDITIONS } from "@/lib/trfs/validation";

export function RegisterForm({ trfSampleId }: { trfSampleId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<RegisterSampleInput>(emptyRegisterSampleInput());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setErrors({}); setFormError(null);
    startTransition(async () => {
      const res = await registerSampleAction(trfSampleId, form);
      if (!res.ok) { setFormError(res.error ?? "Failed to register sample."); if (res.fieldErrors) setErrors(res.fieldErrors); return; }
      router.refresh();
    });
  }

  return (
    <Card className="border-brand-300">
      <CardHeader title="Register this sample" subtitle="Confirms registration date/time and registering staff automatically" />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Storage condition" required>
          <Select value={form.storageCondition} onChange={(e) => setForm({ ...form, storageCondition: e.target.value })}>
            {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          {errors.storageCondition ? <p className="mt-1 text-[11px] text-rose-600">{errors.storageCondition}</p> : null}
        </Field>
        <Field label="Storage location"><Input value={form.storageLocation ?? ""} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} /></Field>
        <Field label="Internal remarks" hint="Not shared with the customer"><Textarea value={form.remarks ?? ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
      </CardContent>
      {formError ? <CardContent className="text-xs font-medium text-rose-600">{formError}</CardContent> : null}
      <CardContent className="border-t border-[var(--border-soft)]">
        <Button onClick={submit} disabled={pending}>{pending ? "Registering…" : "Register Sample"}</Button>
      </CardContent>
    </Card>
  );
}
