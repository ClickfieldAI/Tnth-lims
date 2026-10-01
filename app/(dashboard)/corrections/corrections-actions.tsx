"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import {
  requestCorrectionAction,
  startCorrectionReviewAction,
  approveCorrectionAction,
  rejectCorrectionAction,
  completeCorrectionAction,
} from "@/actions/corrections";

interface EligibleReport {
  id: string;
  reportCode: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sampleRegistration?: any;
}

export function NewCorrectionForm({ reports }: { reports: EligibleReport[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftReportId, setDraftReportId] = useState(reports[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const [correctedValue, setCorrectedValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} disabled={!reports.length}>
        {reports.length ? "Request Correction" : "No eligible reports yet"}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">New correction request</h3>
      <Field label="Report" required>
        <Select value={draftReportId} onChange={(e) => setDraftReportId(e.target.value)}>
          {reports.map((r) => (
            <option key={r.id} value={r.id}>{r.reportCode} — {r.sampleRegistration?.sampleCode ?? "—"}</option>
          ))}
        </Select>
      </Field>
      <Field label="What is being corrected" required hint={fieldErrors.description}>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Impurity result for Parameter X" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Original value (preserved)" required hint={fieldErrors.originalValue}>
          <Input value={originalValue} onChange={(e) => setOriginalValue(e.target.value)} />
        </Field>
        <Field label="Corrected value" required hint={fieldErrors.correctedValue}>
          <Input value={correctedValue} onChange={(e) => setCorrectedValue(e.target.value)} />
        </Field>
      </div>
      <Field label="Reason" required hint={fieldErrors.reason}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </Field>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !draftReportId} onClick={() => startTransition(async () => {
          setFieldErrors({});
          const res = await requestCorrectionAction({ draftReportId, description, originalValue, correctedValue, reason });
          if (!res.ok) { setError(res.error ?? "Failed."); setFieldErrors(res.fieldErrors ?? {}); return; }
          setOpen(false); setDescription(""); setOriginalValue(""); setCorrectedValue(""); setReason("");
          router.refresh();
        })}>
          {pending ? "Submitting…" : "Submit Request"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function CorrectionActions({ id, status, canDecide, canComplete }: { id: string; status: string; canDecide: boolean; canComplete: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "reject">("none");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => startTransition(async () => {
    const res = await fn();
    if (!res.ok) return setError(res.error ?? "Failed.");
    setMode("none"); router.refresh();
  });

  if (status === "REQUESTED") {
    if (!canDecide) return <span className="text-xs text-slate-400">Awaiting a reviewer</span>;
    return <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => startCorrectionReviewAction(id))}>Claim for Review</Button>;
  }

  if (status === "UNDER_REVIEW") {
    if (!canDecide) return <span className="text-xs text-slate-400">Under review</span>;
    if (mode === "reject") {
      return (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
          <Field label="Rejection reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => rejectCorrectionAction(id, reason))}>Confirm Reject</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("none")}>Back</Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="success" disabled={pending} onClick={() => run(() => approveCorrectionAction(id))}>Approve</Button>
        <Button size="sm" variant="danger" onClick={() => setMode("reject")}>Reject</Button>
      </div>
    );
  }

  if (status === "APPROVED") {
    if (!canComplete) return <span className="text-xs text-slate-400">Approved — awaiting completion</span>;
    return (
      <>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <Button size="sm" disabled={pending} onClick={() => run(() => completeCorrectionAction(id))}>Complete</Button>
      </>
    );
  }

  return <span className="text-xs text-slate-400">{status === "COMPLETED" ? "Completed" : "Rejected"}</span>;
}
