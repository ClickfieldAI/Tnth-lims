"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/forms";
import { generateDraftReportAction, submitDraftReportForQaAction, createReportRevisionAction, getDraftReportPdfDataAction } from "@/actions/reports-draft";

export function GenerateButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const r = await generateDraftReportAction(id); if (!r.ok) return setError(r.error ?? "Failed"); router.refresh(); })}>
        {pending ? "Generating…" : "Generate Report"}
      </Button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function SubmitForQaButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const r = await submitDraftReportForQaAction(id); if (!r.ok) return setError(r.error ?? "Failed"); router.refresh(); })}>
        {pending ? "Submitting…" : "Submit for QA Review"}
      </Button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function ReviseButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Create Revision</Button>;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <Field label="Reason for revision" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => {
          const r = await createReportRevisionAction(id, reason);
          if (!r.ok) return setError(r.error ?? "Failed");
          router.push(`/reports/draft/${r.id}`); router.refresh();
        })}>
          {pending ? "Creating…" : "Create revision"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function DownloadPdfButton({ id, reportCode }: { id: string; reportCode: string }) {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const data = await getDraftReportPdfDataAction(id);
      if (!data) return;
      const { generateTnthReportPdf } = await import("@/lib/tnth-pdf");
      const doc = generateTnthReportPdf(data);
      doc.save(`${reportCode}-draft.pdf`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={download} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
    </Button>
  );
}
