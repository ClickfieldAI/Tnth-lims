"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { cancelSampleRegistrationAction, updateSampleStorageAction, generateSampleLabelData, generateSampleAcknowledgementData } from "@/actions/registration";
import { STORAGE_CONDITIONS } from "@/lib/trfs/validation";

export function PrintLabelButton({ trfSampleId, sampleCode }: { trfSampleId: string; sampleCode: string }) {
  const [loading, setLoading] = useState(false);
  async function print() {
    setLoading(true);
    try {
      const data = await generateSampleLabelData(trfSampleId);
      if (!data) return;
      const { generateSampleLabelPdf } = await import("@/lib/sample-label-pdf");
      const doc = generateSampleLabelPdf(data);
      doc.save(`${sampleCode}-label.pdf`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={print} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print Label
    </Button>
  );
}

export function DownloadAcknowledgementButton({ trfSampleId, sampleCode }: { trfSampleId: string; sampleCode: string }) {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const data = await generateSampleAcknowledgementData(trfSampleId);
      if (!data) return;
      const { generateSampleAcknowledgementPdf } = await import("@/lib/sample-acknowledgement-pdf");
      const doc = generateSampleAcknowledgementPdf(data);
      doc.save(`${sampleCode}-acknowledgement.pdf`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={download} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Acknowledgement
    </Button>
  );
}

export function CancelRegistrationButton({ registrationId, trfSampleId }: { registrationId: string; trfSampleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return <Button size="sm" variant="danger" onClick={() => setOpen(true)}>Cancel Registration</Button>;

  return (
    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <p className="text-xs text-rose-800">Cancellation is permanent and audited. This Sample ID will never be reused.</p>
      <Field label="Cancellation reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm" variant="danger" disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await cancelSampleRegistrationAction(registrationId, trfSampleId, reason);
            if (!res.ok) return setError(res.error ?? "Failed.");
            setOpen(false); router.refresh();
          })}
        >
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
      </div>
    </div>
  );
}

export function StorageUpdateForm({ registrationId, trfSampleId, storageCondition, storageLocation }: { registrationId: string; trfSampleId: string; storageCondition: string; storageLocation?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [condition, setCondition] = useState(storageCondition);
  const [location, setLocation] = useState(storageLocation ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) return <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Update Storage</Button>;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <Field label="Storage condition" required>
        <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
          {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Storage location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm" disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await updateSampleStorageAction(registrationId, trfSampleId, { storageCondition: condition, storageLocation: location });
            if (!res.ok) return setError(res.error ?? "Failed.");
            setEditing(false); router.refresh();
          })}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}
