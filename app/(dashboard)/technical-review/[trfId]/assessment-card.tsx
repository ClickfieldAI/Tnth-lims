"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/forms";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  saveAssessmentAction, acceptSampleReviewAction, holdSampleReviewAction, resumeSampleReviewAction,
  rejectSampleReviewAction, requestSampleClarificationAction,
} from "@/actions/reviews";
import { CONDITION_RATING, emptyAssessmentInput, type TechnicalAssessmentInput } from "@/lib/reviews/validation";
import { formatDateTime } from "@/lib/utils";

export interface ReviewSample {
  id: string;
  sampleName: string;
  productCategory: string;
  customerSampleRef?: string;
  receipt: { hasDiscrepancy: boolean; discrepancyTypes: string[]; discrepancyRemarks?: string } | null;
  technicalReview: {
    status: string;
    labelingSatisfactory: string; quantitySufficient: string; packagingSatisfactory: string;
    sampleConditionSatisfactory: string; testRequestComplete: string; assessmentNotes?: string;
    holdReason?: string | null; rejectionReason?: string | null; clarificationComments?: string | null;
    reviewedAt?: string | null; reviewedByName?: string;
  } | null;
}

const ASSESSMENT_FIELDS: { key: keyof TechnicalAssessmentInput; label: string }[] = [
  { key: "labelingSatisfactory", label: "Labeling" },
  { key: "quantitySufficient", label: "Sample quantity" },
  { key: "packagingSatisfactory", label: "Packaging" },
  { key: "sampleConditionSatisfactory", label: "Sample condition" },
  { key: "testRequestComplete", label: "Test-request completeness" },
];

export function AssessmentCard({ trfId, sample, canAssess, canDecide }: { trfId: string; sample: ReviewSample; canAssess: boolean; canDecide: boolean }) {
  const router = useRouter();
  const review = sample.technicalReview;
  const [form, setForm] = useState<TechnicalAssessmentInput>(
    review ? { labelingSatisfactory: review.labelingSatisfactory, quantitySufficient: review.quantitySufficient, packagingSatisfactory: review.packagingSatisfactory, sampleConditionSatisfactory: review.sampleConditionSatisfactory, testRequestComplete: review.testRequestComplete, assessmentNotes: review.assessmentNotes }
      : emptyAssessmentInput(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"none" | "hold" | "reject" | "clarify">("none");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const status = review?.status ?? "PENDING";
  const locked = ["ACCEPTED", "REJECTED"].includes(status);

  function saveAssessment() {
    setErrors({}); setFormError(null);
    startTransition(async () => {
      const res = await saveAssessmentAction(trfId, sample.id, form);
      if (!res.ok) { setFormError(res.error ?? "Failed to save."); if (res.fieldErrors) setErrors(res.fieldErrors); return; }
      router.refresh();
    });
  }

  function decide(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setFormError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setFormError(res.error ?? "Failed.");
      setDialog("none"); setText("");
      router.refresh();
    });
  }

  return (
    <Card className={sample.receipt?.hasDiscrepancy ? "border-rose-300" : undefined}>
      <CardHeader
        title={sample.sampleName}
        subtitle={`${sample.productCategory} · Ref ${sample.customerSampleRef || "—"}`}
        action={<StatusBadge status={status} dot />}
      />

      {sample.receipt?.hasDiscrepancy ? (
        <CardContent className="border-b border-[var(--border-soft)] bg-rose-50">
          <p className="text-xs font-semibold text-rose-800">Receipt discrepancy: {sample.receipt.discrepancyTypes.join(", ")}</p>
          <p className="text-xs text-rose-700">{sample.receipt.discrepancyRemarks}</p>
        </CardContent>
      ) : null}

      <CardContent className="grid gap-4 sm:grid-cols-2">
        {ASSESSMENT_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} required>
            <Select
              value={form[f.key] as string}
              disabled={!canAssess || locked}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            >
              {CONDITION_RATING.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            {errors[f.key] ? <p className="mt-1 text-[11px] text-rose-600">{errors[f.key]}</p> : null}
          </Field>
        ))}
        <Field label="Assessment notes" hint="Sample suitability, labeling, quantity, packaging and condition observations">
          <Textarea value={form.assessmentNotes ?? ""} onChange={(e) => setForm({ ...form, assessmentNotes: e.target.value })} disabled={!canAssess || locked} />
        </Field>
      </CardContent>

      {formError ? <CardContent className="text-xs font-medium text-rose-600">{formError}</CardContent> : null}

      {canAssess && !locked ? (
        <CardContent className="border-t border-[var(--border-soft)]">
          <Button size="sm" onClick={saveAssessment} disabled={pending}>{pending ? "Saving…" : "Save assessment"}</Button>
        </CardContent>
      ) : null}

      {canDecide && ["UNDER_REVIEW", "ON_HOLD", "CLARIFICATION_REQUESTED"].includes(status) ? (
        <CardContent className="space-y-2 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" onClick={() => decide(() => acceptSampleReviewAction(trfId, sample.id))} disabled={pending}>Accept</Button>
            {status !== "ON_HOLD" ? <Button size="sm" variant="outline" onClick={() => setDialog("hold")} disabled={pending}>Place On Hold</Button> : (
              <Button size="sm" variant="outline" onClick={() => decide(() => resumeSampleReviewAction(trfId, sample.id))} disabled={pending}>Resume Review</Button>
            )}
            {status === "UNDER_REVIEW" ? <Button size="sm" variant="secondary" onClick={() => setDialog("clarify")} disabled={pending}>Request Clarification</Button> : null}
            <Button size="sm" variant="danger" onClick={() => setDialog("reject")} disabled={pending}>Reject</Button>
          </div>
          {dialog !== "none" ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <Field label={dialog === "hold" ? "Hold reason" : dialog === "reject" ? "Rejection reason" : "Clarification comment"} required>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
              </Field>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={dialog === "reject" ? "danger" : "primary"}
                  disabled={pending}
                  onClick={() => decide(() =>
                    dialog === "hold" ? holdSampleReviewAction(trfId, sample.id, text)
                      : dialog === "reject" ? rejectSampleReviewAction(trfId, sample.id, text)
                        : requestSampleClarificationAction(trfId, sample.id, text))}
                >
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog("none")}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      ) : null}

      {review?.holdReason ? <CardContent className="text-xs text-amber-700"><strong>Hold reason:</strong> {review.holdReason}</CardContent> : null}
      {review?.rejectionReason ? <CardContent className="text-xs text-rose-700"><strong>Rejection reason:</strong> {review.rejectionReason}</CardContent> : null}
      {review?.clarificationComments ? <CardContent className="text-xs text-violet-700"><strong>Clarification requested:</strong> {review.clarificationComments}</CardContent> : null}
      {review?.reviewedAt ? <CardContent className="text-xs text-slate-400">Decided {formatDateTime(review.reviewedAt)} by {review.reviewedByName ?? "—"}</CardContent> : null}
      {locked ? <CardContent><Badge tone="zinc">Decision recorded — no further changes</Badge></CardContent> : null}
    </Card>
  );
}
