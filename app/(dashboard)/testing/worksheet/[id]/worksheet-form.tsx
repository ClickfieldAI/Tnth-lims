"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitTestResult, reviewTest } from "@/actions/tests";
import { Field, Input, Textarea, Select } from "@/components/ui/forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type DissolutionTp = { t?: number; p?: number; time?: number; dissolvedPercent?: number };

export function WorksheetForm({
  testId, type, status, instruments, assay, dissolution, observations,
}: {
  testId: string;
  type: string;
  status: string;
  instruments: { id: string; code: string; name: string }[];
  assay: { expectedLow: number | null; expectedHigh: number | null; resultPercent: number | null } | null;
  dissolution: {
    apparatus: string | null; medium: string | null; rpm: number | null;
    temperature: number | null; timepoints: DissolutionTp[];
  } | null;
  observations: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editable = status === "TESTING" || status === "ASSIGNED" || status === "REVIEW";

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await submitTestResult(formData);
      if (!res.ok) setError(res.error ?? "Failed to save");
      else router.refresh();
    });
  }

  const pass =
    assay?.resultPercent != null &&
    assay.resultPercent >= (assay.expectedLow ?? 95) &&
    assay.resultPercent <= (assay.expectedHigh ?? 105);

  return (
    <Card>
      <div className="flex items-center justify-between px-5 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Worksheet & result entry</h3>
          <p className="text-xs text-slate-500">Record raw data, calculations and analyst observations.</p>
        </div>
        {assay?.resultPercent != null ? (
          <Badge tone={pass ? "green" : "red"}>{assay.resultPercent.toFixed(1)}% · {pass ? "PASS" : "FAIL"}</Badge>
        ) : null}
      </div>

      <form action={onSubmit} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <input type="hidden" name="testId" value={testId} />

        <Field label="Instrument used">
          <Select name="instrumentId" defaultValue="" disabled={!editable}>
            <option value="">— keep current —</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
            ))}
          </Select>
        </Field>

        <TypeSpecificFields type={type} assay={assay} dissolution={dissolution} editable={editable} />

        <div className="sm:col-span-2">
          <Field label="Analyst observations">
            <Textarea name="observations" defaultValue={observations}
              placeholder="Peak shape, system suitability, deviations…" disabled={!editable} />
          </Field>
        </div>

        {error ? <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p> : null}

        {editable ? (
          <div className="sm:col-span-2">
            <Button disabled={pending}>{pending ? "Submitting…" : "Submit for QA review"}</Button>
          </div>
        ) : (
          <p className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            This worksheet is locked — results have been submitted for review.
          </p>
        )}
      </form>
    </Card>
  );
}

function TypeSpecificFields({
  type, assay, dissolution, editable,
}: {
  type: string;
  assay: { expectedLow: number | null; expectedHigh: number | null; resultPercent: number | null } | null;
  dissolution: { apparatus: string | null; medium: string | null; rpm: number | null; temperature: number | null; timepoints: DissolutionTp[] } | null;
  editable: boolean;
}) {
  if (type === "ASSAY") {
    return (
      <>
        <Field label="Expected range (% label claim)">
          <div className="flex gap-2">
            <Input name="expectedLow" type="number" step="0.1" defaultValue={assay?.expectedLow ?? 95} disabled={!editable} />
            <Input name="expectedHigh" type="number" step="0.1" defaultValue={assay?.expectedHigh ?? 105} disabled={!editable} />
          </div>
        </Field>
        <Field label="Assay result (% of label claim)" required>
          <Input name="assayPercent" type="number" step="0.01" placeholder="98.60"
            defaultValue={assay?.resultPercent ?? ""} disabled={!editable} required={editable} />
        </Field>
      </>
    );
  }
  if (type === "DISSOLUTION" && dissolution) {
    const tps: DissolutionTp[] = dissolution.timepoints.length
      ? dissolution.timepoints
      : [15, 30, 45, 60].map((t) => ({ t }) as DissolutionTp);
    return (
      <div className="sm:col-span-2">
        <Field label={`Dissolution profile — ${dissolution.apparatus ?? "USP II"}, ${dissolution.medium ?? "0.1N HCl"}, ${dissolution.rpm ?? 100} RPM, ${dissolution.temperature ?? 37}°C`}>
          <div className="grid grid-cols-4 gap-2">
            {tps.map((tp, i) => (
              <Input key={i} name="timepoint" type="number" step="0.1"
                placeholder={`${tp.t ?? tp.time ?? ""} min`}
                defaultValue={tp.p ?? tp.dissolvedPercent ?? ""} disabled={!editable} />
            ))}
          </div>
        </Field>
      </div>
    );
  }
  if (type === "MICROBIOLOGY") {
    return (
      <Field label="Colony forming units (CFU)">
        <Input name="colonyCount" type="number" step="1" placeholder="22" disabled={!editable} />
      </Field>
    );
  }
  if (type === "IMPURITY") {
    return (
      <Field label="Observed impurity level (%)">
        <Input name="impurityValue" type="number" step="0.001" placeholder="0.08" disabled={!editable} />
      </Field>
    );
  }
  return null;
}

export function ReviewActions({ testId }: { testId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  function act(action: "APPROVE" | "REJECT") {
    startTransition(async () => {
      await reviewTest(testId, action, comment);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Review comment (optional for approval)" />
      <div className="flex gap-2">
        <Button variant="success" onClick={() => act("APPROVE")} disabled={pending}>Approve & generate report</Button>
        <Button variant="danger" onClick={() => act("REJECT")} disabled={pending}>Return to analyst</Button>
      </div>
    </div>
  );
}