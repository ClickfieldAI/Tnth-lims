"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { Badge } from "@/components/ui/badge";
import { recordSampleReceiptAction, addDiscrepancyReviewAction } from "@/actions/receipts";
import {
  CONTAINER_CONDITIONS, SEAL_CONDITIONS, DISCREPANCY_TYPES, emptySampleReceiptInput,
  type SampleReceiptInput, type FieldErrors,
} from "@/lib/receipts/validation";
import { STORAGE_CONDITIONS } from "@/lib/trfs/validation";
import { formatDateTime } from "@/lib/utils";

export interface ReceiptSample {
  id: string;
  sampleName: string;
  productCategory: string;
  quantity: number;
  quantityUnit: string;
  containers: number;
  customerSampleRef?: string;
  receipt?: {
    receivedAt: string;
    receivedQuantity: number;
    receivedQuantityUnit: string;
    containerCondition: string;
    sealCondition: string;
    temperature?: string;
    storageCondition: string;
    storageLocation?: string;
    remarks?: string;
    hasDiscrepancy: boolean;
    discrepancyTypes: string[];
    discrepancyRemarks?: string;
    receivedByName?: string;
  } | null;
}

export function SampleReceiptCard({
  trfId, sample, canRecord, canReview, locked,
}: {
  trfId: string; sample: ReceiptSample; canRecord: boolean; canReview: boolean; locked: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!sample.receipt);
  const [form, setForm] = useState<SampleReceiptInput>(
    sample.receipt
      ? { ...emptySampleReceiptInput(), receivedDate: sample.receipt.receivedAt.slice(0, 10), receivedQuantity: sample.receipt.receivedQuantity, receivedQuantityUnit: sample.receipt.receivedQuantityUnit, containerCondition: sample.receipt.containerCondition, sealCondition: sample.receipt.sealCondition, temperature: sample.receipt.temperature, storageCondition: sample.receipt.storageCondition, storageLocation: sample.receipt.storageLocation, remarks: sample.receipt.remarks, hasDiscrepancy: sample.receipt.hasDiscrepancy, discrepancyTypes: sample.receipt.discrepancyTypes, discrepancyRemarks: sample.receipt.discrepancyRemarks }
      : { ...emptySampleReceiptInput(), receivedQuantity: sample.quantity, receivedQuantityUnit: sample.quantityUnit },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleDiscrepancyType(type: string) {
    setForm((f) => ({ ...f, discrepancyTypes: f.discrepancyTypes.includes(type) ? f.discrepancyTypes.filter((t) => t !== type) : [...f.discrepancyTypes, type] }));
  }

  function save() {
    setErrors({}); setFormError(null);
    startTransition(async () => {
      const res = await recordSampleReceiptAction(trfId, sample.id, form);
      if (!res.ok) { setFormError(res.error ?? "Failed to save."); if (res.fieldErrors) setErrors(res.fieldErrors); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function submitReview() {
    startTransition(async () => {
      const res = await addDiscrepancyReviewAction(trfId, sample.id, reviewComment);
      if (res.ok) { setReviewSaved(true); router.refresh(); }
    });
  }

  return (
    <Card className={sample.receipt?.hasDiscrepancy ? "border-rose-300" : undefined}>
      <CardHeader
        title={sample.sampleName}
        subtitle={`${sample.productCategory} · Ref ${sample.customerSampleRef || "—"} · Requested ${sample.quantity} ${sample.quantityUnit}`}
        action={sample.receipt ? (
          <Badge tone={sample.receipt.hasDiscrepancy ? "red" : "green"}>{sample.receipt.hasDiscrepancy ? "Discrepancy" : "Received OK"}</Badge>
        ) : <Badge tone="zinc">Not yet received</Badge>}
      />
      {!editing && sample.receipt ? (
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row label="Received" value={formatDateTime(sample.receipt.receivedAt)} />
          <Row label="Quantity" value={`${sample.receipt.receivedQuantity} ${sample.receipt.receivedQuantityUnit}`} />
          <Row label="Container" value={sample.receipt.containerCondition} />
          <Row label="Seal" value={sample.receipt.sealCondition} />
          <Row label="Storage" value={`${sample.receipt.storageCondition}${sample.receipt.storageLocation ? " · " + sample.receipt.storageLocation : ""}`} />
          <Row label="Temperature" value={sample.receipt.temperature || "—"} />
          <Row label="Received by" value={sample.receipt.receivedByName} />
          <Row label="Remarks" value={sample.receipt.remarks || "—"} />
          {sample.receipt.hasDiscrepancy ? (
            <div className="col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 sm:col-span-4">
              <p className="text-xs font-semibold text-rose-800">Discrepancy: {sample.receipt.discrepancyTypes.join(", ")}</p>
              <p className="text-xs text-rose-700">{sample.receipt.discrepancyRemarks}</p>
            </div>
          ) : null}
        </CardContent>
      ) : null}

      {editing ? (
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Received date" required><Input type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />{errors.receivedDate ? <p className="mt-1 text-[11px] text-rose-600">{errors.receivedDate}</p> : null}</Field>
          <Field label="Received time"><Input type="time" value={form.receivedTime ?? ""} onChange={(e) => setForm({ ...form, receivedTime: e.target.value })} /></Field>
          <Field label="Received quantity" required>
            <div className="flex gap-2">
              <Input type="number" min={0} value={form.receivedQuantity} onChange={(e) => setForm({ ...form, receivedQuantity: Number(e.target.value) })} />
              <Input className="w-24" value={form.receivedQuantityUnit} onChange={(e) => setForm({ ...form, receivedQuantityUnit: e.target.value })} />
            </div>
            {errors.receivedQuantity ? <p className="mt-1 text-[11px] text-rose-600">{errors.receivedQuantity}</p> : null}
            {errors.receivedQuantityUnit ? <p className="mt-1 text-[11px] text-rose-600">{errors.receivedQuantityUnit}</p> : null}
          </Field>
          <Field label="Container / packaging condition" required>
            <Select value={form.containerCondition} onChange={(e) => setForm({ ...form, containerCondition: e.target.value })}>
              {CONTAINER_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Seal condition" required>
            <Select value={form.sealCondition} onChange={(e) => setForm({ ...form, sealCondition: e.target.value })}>
              {SEAL_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Temperature (where applicable)"><Input value={form.temperature ?? ""} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></Field>
          <Field label="Storage condition" required>
            <Select value={form.storageCondition} onChange={(e) => setForm({ ...form, storageCondition: e.target.value })}>
              {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Storage location"><Input value={form.storageLocation ?? ""} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} /></Field>
          <Field label="Remarks"><Textarea value={form.remarks ?? ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>

          <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.hasDiscrepancy} onChange={(e) => setForm({ ...form, hasDiscrepancy: e.target.checked })} />
              Record a discrepancy for this sample
            </label>
            {form.hasDiscrepancy ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Discrepancy type(s)</p>
                  <div className="flex flex-wrap gap-3">
                    {DISCREPANCY_TYPES.map((d) => (
                      <label key={d} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={form.discrepancyTypes.includes(d)} onChange={() => toggleDiscrepancyType(d)} /> {d}
                      </label>
                    ))}
                  </div>
                  {errors.discrepancyTypes ? <p className="mt-1 text-[11px] text-rose-600">{errors.discrepancyTypes}</p> : null}
                </div>
                <Field label="Discrepancy remarks" required>
                  <Textarea value={form.discrepancyRemarks ?? ""} onChange={(e) => setForm({ ...form, discrepancyRemarks: e.target.value })} />
                  {errors.discrepancyRemarks ? <p className="mt-1 text-[11px] text-rose-600">{errors.discrepancyRemarks}</p> : null}
                </Field>
              </div>
            ) : null}
          </div>
        </CardContent>
      ) : null}

      {formError ? <CardContent className="text-xs font-medium text-rose-600">{formError}</CardContent> : null}

      {canRecord && !locked ? (
        <CardContent className="flex gap-2 border-t border-[var(--border-soft)]">
          {editing ? (
            <>
              <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : sample.receipt ? "Update receipt" : "Record receipt"}</Button>
              {sample.receipt ? <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button> : null}
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit receipt</Button>
          )}
        </CardContent>
      ) : null}

      {canReview && sample.receipt?.hasDiscrepancy ? (
        <CardContent className="border-t border-[var(--border-soft)] space-y-2">
          <Field label="Discrepancy review comment"><Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} /></Field>
          <Button size="sm" variant="outline" onClick={submitReview} disabled={pending || !reviewComment.trim()}>{reviewSaved ? "Comment added" : "Add review comment"}</Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value || "—"}</p></div>);
}
