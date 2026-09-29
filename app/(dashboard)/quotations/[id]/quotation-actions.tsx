"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/forms";
import {
  submitQuotationForApprovalAction, approveQuotationAction, rejectQuotationAction, sendQuotationAction,
  createQuotationRevisionAction, recordAcceptanceAction, recordRejectionAction, getQuotationPdfData,
} from "@/actions/enquiries";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, after?: (id?: string) => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Failed");
      router.refresh();
      after?.(res.id);
    });
  }
  return { pending, error, run };
}

export function SubmitForApprovalButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <Button size="sm" disabled={pending} onClick={() => run(() => submitQuotationForApprovalAction(id))}>{pending ? "Submitting…" : "Submit for Approval"}</Button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function ApproveRejectButtons({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant="success" disabled={pending} onClick={() => run(() => approveQuotationAction(id))}>Approve</Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => setReject(true)}>Reject</Button>
      </div>
      {reject ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <Field label="Rejection reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => rejectQuotationAction(id, reason), () => setReject(false))}>Confirm reject</Button>
            <Button size="sm" variant="ghost" onClick={() => setReject(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function SendButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <Button size="sm" disabled={pending} onClick={() => run(() => sendQuotationAction(id))}>{pending ? "Sending…" : "Mark as Sent"}</Button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function ReviseButton({ id }: { id: string }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Create Revision</Button>;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <Field label="Reason for revision" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => createQuotationRevisionAction(id, reason), (newId) => { if (newId) router.push(`/quotations/${newId}/edit`); })}>
          {pending ? "Creating…" : "Create revision"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function AcceptanceButtons({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"none" | "accept" | "reject">("none");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  if (mode === "none") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="success" onClick={() => setMode("accept")}>Record Customer Acceptance</Button>
        <Button size="sm" variant="danger" onClick={() => setMode("reject")}>Record Customer Rejection</Button>
      </div>
    );
  }
  if (mode === "accept") {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs text-amber-700">This records a manually-confirmed acceptance by an authorized staff member — not a digitally authenticated customer signature.</p>
        <Field label="Purchase Order number (if supplied)"><Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></Field>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" variant="success" disabled={pending} onClick={() => run(() => recordAcceptanceAction(id, { poNumber, notes }))}>{pending ? "Saving…" : "Confirm acceptance"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <Field label="Rejection reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => recordRejectionAction(id, reason))}>{pending ? "Saving…" : "Confirm rejection"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
      </div>
    </div>
  );
}

export function PdfButton({ id, quotationCode }: { id: string; quotationCode: string }) {
  const [loading, setLoading] = useState(false);
  async function exportPdf() {
    setLoading(true);
    try {
      const data = await getQuotationPdfData(id);
      if (!data) return;
      const { generateQuotationPdf } = await import("@/lib/quotation-pdf");
      const doc = generateQuotationPdf(data);
      doc.save(`${quotationCode}.pdf`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={exportPdf} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
    </Button>
  );
}
