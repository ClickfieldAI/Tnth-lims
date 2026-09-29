"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil, XCircle, FileText, ReceiptText } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/forms";
import { closeEnquiryAction, createQuotationAction } from "@/actions/enquiries";

export function RowActions({ id, canEdit, canClose, closed, quotationId }: { id: string; canEdit: boolean; canClose: boolean; closed: boolean; quotationId?: string }) {
  const router = useRouter();
  const [confirmClose, setConfirmClose] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <Link href={`/enquiries/${id}`} className={buttonClass("ghost", "icon")} title="View"><Eye className="h-4 w-4" /></Link>
      {canEdit && !closed ? <Link href={`/enquiries/${id}/edit`} className={buttonClass("ghost", "icon")} title="Edit"><Pencil className="h-4 w-4" /></Link> : null}
      {quotationId ? (
        <Link href={`/quotations/${quotationId}`} className={buttonClass("ghost", "icon")} title="View quotation"><FileText className="h-4 w-4" /></Link>
      ) : canEdit && !closed ? (
        <button
          className={buttonClass("ghost", "icon")}
          title="Create quotation"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await createQuotationAction(id);
            if (res.ok && res.id) router.push(`/quotations/${res.id}/edit`);
          })}
        >
          <ReceiptText className="h-4 w-4" />
        </button>
      ) : null}
      {canClose && !closed ? (
        <button className={buttonClass("ghost", "icon")} title="Close enquiry" onClick={() => setConfirmClose(true)}><XCircle className="h-4 w-4" /></button>
      ) : null}
      {confirmClose ? <CloseDialog id={id} onClose={() => setConfirmClose(false)} /> : null}
    </div>
  );
}

function CloseDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-800">Close this enquiry?</h3>
        <p className="mt-1 text-xs text-slate-500">The enquiry is kept for history; a reason is required and recorded in the audit trail.</p>
        <div className="mt-3"><Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field></div>
        {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const res = await closeEnquiryAction(id, reason);
              if (!res.ok) return setError(res.error ?? "Failed");
              onClose();
              router.refresh();
            })}
          >
            {pending ? "Closing…" : "Close enquiry"}
          </Button>
        </div>
      </div>
    </div>
  );
}
