"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { createDeliveryAction, retryDeliveryAction, markDeliveryFailedAction } from "@/actions/delivery";
import { DELIVERY_METHODS } from "@/lib/delivery/validation";

export function DeliveryForm({ draftReportId, latestStatus, canManage }: { draftReportId: string; latestStatus: string | null; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>(DELIVERY_METHODS[0]);
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canManage) return <span className="text-xs text-slate-400">View only</span>;

  const isRetry = latestStatus === "FAILED";
  const isActive = latestStatus === "PENDING" || latestStatus === "DELIVERED";

  if (isActive) return <span className="text-xs text-emerald-600">Delivered</span>;
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{isRetry ? "Retry Delivery" : "Deliver"}</Button>;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <Field label="Delivery method" required>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {DELIVERY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </Field>
      <Field label="Recipient" required><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Email address or portal user" /></Field>
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !recipient.trim()} onClick={() => startTransition(async () => {
          const res = isRetry
            ? await retryDeliveryAction(draftReportId, { deliveryMethod: method, recipient, notes })
            : await createDeliveryAction(draftReportId, { deliveryMethod: method, recipient, notes });
          if (!res.ok) return setError(res.error ?? "Failed.");
          setOpen(false);
          router.refresh();
        })}>
          {pending ? "Sending…" : isRetry ? "Retry" : "Send"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function MarkFailedButton({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Mark Failed</Button>;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
      <Field label="Failure reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      <div className="flex gap-2">
        <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => { await markDeliveryFailedAction(deliveryId, reason); router.refresh(); })}>Confirm</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
