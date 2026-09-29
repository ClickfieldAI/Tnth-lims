"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil, Power, History } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/forms";
import { setCustomerStatusAction } from "@/actions/customers";

export function RowActions({ id, isActive, canManage }: { id: string; isActive: boolean; canManage: boolean }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Link href={`/clients/${id}`} className={buttonClass("ghost", "icon")} title="View">
        <Eye className="h-4 w-4" />
      </Link>
      {canManage ? (
        <Link href={`/clients/${id}/edit`} className={buttonClass("ghost", "icon")} title="Edit">
          <Pencil className="h-4 w-4" />
        </Link>
      ) : null}
      {canManage ? (
        <button className={buttonClass("ghost", "icon")} title={isActive ? "Deactivate" : "Reactivate"} onClick={() => setConfirm(true)}>
          <Power className="h-4 w-4" />
        </button>
      ) : null}
      <Link href={`/clients/${id}#history`} className={buttonClass("ghost", "icon")} title="View history">
        <History className="h-4 w-4" />
      </Link>
      {confirm ? <StatusDialog id={id} isActive={isActive} onClose={() => setConfirm(false)} /> : null}
    </div>
  );
}

function StatusDialog({ id, isActive, onClose }: { id: string; isActive: boolean; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      const res = await setCustomerStatusAction(id, !isActive, reason);
      if (!res.ok) return setError(res.error ?? "Failed");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-800">{isActive ? "Deactivate customer?" : "Reactivate customer?"}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {isActive
            ? "The customer record is kept and never deleted; it will be hidden from active lists and marked inactive in the audit trail."
            : "This will mark the customer active again."}
        </p>
        <div className="mt-3">
          <Field label="Reason (optional)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
        </div>
        {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant={isActive ? "danger" : "success"} onClick={confirm} disabled={pending}>
            {pending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
