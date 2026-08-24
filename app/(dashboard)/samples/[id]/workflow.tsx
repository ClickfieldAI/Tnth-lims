"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignSample, advanceSampleStatus } from "@/actions/samples";
import { Field, Select } from "@/components/ui/forms";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Record<string, string> = {
  RECEIVED: "LOGGED",
  LOGGED: "ASSIGNED",
  ASSIGNED: "TESTING",
  TESTING: "REVIEW",
};

export function SampleWorkflow({
  sampleId,
  status,
  analysts,
  currentAnalyst,
}: {
  sampleId: string;
  status: string;
  analysts: { id: string; name: string }[];
  currentAnalyst: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [analystId, setAnalystId] = useState(currentAnalyst ?? "");
  const [error, setError] = useState<string | null>(null);
  const nextStatus = NEXT_STATUS[status];

  function assign() {
    if (!analystId) return setError("Select an analyst first.");
    setError(null);
    startTransition(async () => {
      const res = await assignSample(sampleId, analystId);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  function advance() {
    if (!nextStatus) return;
    setError(null);
    startTransition(async () => {
      const res = await advanceSampleStatus(sampleId, nextStatus);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Field label="Assign analyst">
        <div className="flex gap-2">
          <Select value={analystId} onChange={(e) => setAnalystId(e.target.value)}>
            <option value="">Select analyst…</option>
            {analysts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={assign} disabled={pending}>Assign</Button>
        </div>
      </Field>

      {nextStatus ? (
        <Button size="sm" className="w-full" onClick={advance} disabled={pending}>
          Advance to {nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}
        </Button>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          This sample is at a terminal or QA-controlled stage — status changes are handled through
          the QA review and batch release workflows.
        </p>
      )}

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}