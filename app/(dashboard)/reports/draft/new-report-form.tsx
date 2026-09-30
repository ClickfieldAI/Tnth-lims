"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/forms";
import { createDraftReportAction } from "@/actions/reports-draft";

export interface RegisteredSampleOption { id: string; sampleCode: string; trfCode: string; customerName: string }
export interface VerifiedResultOption { testResultId: string; requestedParameter: string }

export function NewReportForm({ samples, verifiedBySample }: { samples: RegisteredSampleOption[]; verifiedBySample: Record<string, VerifiedResultOption[]> }) {
  const router = useRouter();
  const [sampleId, setSampleId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = useMemo(() => verifiedBySample[sampleId] ?? [], [sampleId, verifiedBySample]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createDraftReportAction({ sampleRegistrationId: sampleId, testResultIds: selected });
      if (!res.ok) return setError(res.error ?? "Failed to create report.");
      router.push(`/reports/draft/${res.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Create Draft Report" subtitle="Select a registered sample and the verified results to include" />
      <CardContent className="space-y-3">
        <Select value={sampleId} onChange={(e) => { setSampleId(e.target.value); setSelected([]); }}>
          <option value="">Select a registered sample…</option>
          {samples.map((s) => <option key={s.id} value={s.id}>{s.sampleCode} — {s.trfCode} — {s.customerName}</option>)}
        </Select>
        {sampleId ? (
          <div className="space-y-2">
            {available.map((a) => (
              <label key={a.testResultId} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={selected.includes(a.testResultId)} onChange={() => toggle(a.testResultId)} /> {a.requestedParameter}
              </label>
            ))}
            {!available.length ? <p className="text-sm text-slate-400">No verified results are available for this sample yet.</p> : null}
          </div>
        ) : null}
        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
        <Button onClick={submit} disabled={pending || !sampleId || !selected.length}>{pending ? "Creating…" : "Create Draft Report"}</Button>
      </CardContent>
    </Card>
  );
}
