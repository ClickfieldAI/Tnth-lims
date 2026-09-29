"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Divider } from "@/components/ui/forms";
import { FOOD_TESTING_SERVICES } from "@/lib/enquiries/catalog";
import { SAMPLED_BY, emptyTestRequest, type TrfSampleInput, type FieldErrors } from "@/lib/trfs/validation";

/** Combined "Sample Information" + "Testing Requirements" editor for one
 * sample. The server always validates a sample together with its requested
 * tests as a single unit (a sample isn't useful without at least one valid
 * test), so this editor collects both in one save rather than splitting
 * identity and testing into two separately-persisted steps. */
export function SampleForm({
  value, onChange, onSave, onCancel, errors, saving,
}: {
  value: TrfSampleInput;
  onChange: (v: TrfSampleInput) => void;
  onSave: () => void;
  onCancel: () => void;
  errors: FieldErrors;
  saving: boolean;
}) {
  const s = value;

  function set<K extends keyof TrfSampleInput>(key: K, v: TrfSampleInput[K]) {
    onChange({ ...s, [key]: v });
  }
  function updateTest(i: number, patch: Partial<TrfSampleInput["tests"][number]>) {
    onChange({ ...s, tests: s.tests.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  }

  // Validation errors are produced against a single-item array (index 0).
  const err = (k: string) => errors[`samples.0.${k}`] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[`samples.0.${k}`]}</p> : null;

  return (
    <Card className="border-brand-300">
      <CardHeader title="Sample Information" />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Sample name" required><Input value={s.sampleName} onChange={(e) => set("sampleName", e.target.value)} />{err("sampleName")}</Field>
        <Field label="Product category" required><Input value={s.productCategory} onChange={(e) => set("productCategory", e.target.value)} />{err("productCategory")}</Field>
        <Field label="Brand name"><Input value={s.brandName ?? ""} onChange={(e) => set("brandName", e.target.value)} /></Field>
        <Field label="Batch / lot number"><Input value={s.batchNumber ?? ""} onChange={(e) => set("batchNumber", e.target.value)} /></Field>
        <Field label="Customer sample reference"><Input value={s.customerSampleRef ?? ""} onChange={(e) => set("customerSampleRef", e.target.value)} /></Field>
        <Field label="Packaging type"><Input value={s.packagingType ?? ""} onChange={(e) => set("packagingType", e.target.value)} /></Field>
        <Field label="Sample quantity" required>
          <div className="flex gap-2">
            <Input type="number" min={0} value={s.quantity} onChange={(e) => set("quantity", Number(e.target.value))} />
            <Input placeholder="unit" className="w-24" value={s.quantityUnit} onChange={(e) => set("quantityUnit", e.target.value)} />
          </div>
          {err("quantity")}{err("quantityUnit")}
        </Field>
        <Field label="Number of containers" required><Input type="number" min={1} value={s.containers} onChange={(e) => set("containers", Number(e.target.value))} />{err("containers")}</Field>

        <Field label="Manufacturer"><Input value={s.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
        <Field label="Manufacturing date"><Input type="date" value={s.manufacturingDate ?? ""} onChange={(e) => set("manufacturingDate", e.target.value)} /></Field>
        <Field label="Expiry date"><Input type="date" value={s.expiryDate ?? ""} onChange={(e) => set("expiryDate", e.target.value)} />{err("expiryDate")}</Field>
        <Field label="Label claim"><Input value={s.labelClaim ?? ""} onChange={(e) => set("labelClaim", e.target.value)} /></Field>
        <Field label="Declared composition"><Textarea value={s.declaredComposition ?? ""} onChange={(e) => set("declaredComposition", e.target.value)} /></Field>
        <Field label="Product description"><Textarea value={s.productDescription ?? ""} onChange={(e) => set("productDescription", e.target.value)} /></Field>

        <Field label="Sampled by" required>
          <Select value={s.sampledBy} onChange={(e) => set("sampledBy", e.target.value)}>
            {SAMPLED_BY.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
          {err("sampledBy")}
        </Field>
        <Field label="Sampling date"><Input type="date" value={s.samplingDate ?? ""} onChange={(e) => set("samplingDate", e.target.value)} /></Field>
        <Field label="Sampling location"><Input value={s.samplingLocation ?? ""} onChange={(e) => set("samplingLocation", e.target.value)} /></Field>
        <Field label="Sampling procedure (if applicable)"><Input value={s.samplingProcedure ?? ""} onChange={(e) => set("samplingProcedure", e.target.value)} /></Field>
      </CardContent>

      <Divider />

      <CardHeader title="Testing Requirements" subtitle="At least one requested test is required for this sample" />
      <CardContent className="space-y-3">
        {errors["samples.0.tests"] ? <p className="text-xs font-medium text-rose-600">{errors["samples.0.tests"]}</p> : null}
        {s.tests.map((t, ti) => (
          <div key={ti} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={t.customRequest} onChange={(e) => updateTest(ti, { customRequest: e.target.checked, serviceId: "" })} />
                Custom / unavailable method — flag for technical review
              </label>
              {s.tests.length > 1 ? (
                <button type="button" className="text-xs text-rose-500" onClick={() => onChange({ ...s, tests: s.tests.filter((_, j) => j !== ti) })}>Remove</button>
              ) : null}
            </div>
            {t.customRequest ? (
              <>
                <Field label="Custom service name" required>
                  <Input value={t.customServiceName ?? ""} onChange={(e) => updateTest(ti, { customServiceName: e.target.value })} />
                  {errors[`samples.0.tests.${ti}.customServiceName`] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[`samples.0.tests.${ti}.customServiceName`]}</p> : null}
                </Field>
                <div className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700 sm:col-span-1">
                  This method is not in the existing catalog. It is recorded for technical review, not silently substituted or claimed as approved.
                </div>
              </>
            ) : (
              <Field label="Testing division / service" required>
                <Select value={t.serviceId} onChange={(e) => updateTest(ti, { serviceId: e.target.value })}>
                  <option value="">Select…</option>
                  {FOOD_TESTING_SERVICES.map((sv) => <option key={sv.id} value={sv.id}>{sv.division}</option>)}
                </Select>
                {errors[`samples.0.tests.${ti}.serviceId`] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[`samples.0.tests.${ti}.serviceId`]}</p> : null}
              </Field>
            )}
            <Field label="Requested parameter" required>
              <Input value={t.requestedParameter} onChange={(e) => updateTest(ti, { requestedParameter: e.target.value })} />
              {errors[`samples.0.tests.${ti}.requestedParameter`] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[`samples.0.tests.${ti}.requestedParameter`]}</p> : null}
            </Field>
            <Field label="Preferred method"><Input value={t.preferredMethod ?? ""} onChange={(e) => updateTest(ti, { preferredMethod: e.target.value })} /></Field>
            <Field label="Specification / acceptance limits"><Input value={t.specification ?? ""} onChange={(e) => updateTest(ti, { specification: e.target.value })} /></Field>
            <Field label="Testing purpose"><Input value={t.testingPurpose ?? ""} onChange={(e) => updateTest(ti, { testingPurpose: e.target.value })} /></Field>
            <Field label="Required sample quantity"><Input value={t.requiredQuantity ?? ""} onChange={(e) => updateTest(ti, { requiredQuantity: e.target.value })} /></Field>
            <Field label="Customer-specified requirements"><Input value={t.customerRequirements ?? ""} onChange={(e) => updateTest(ti, { customerRequirements: e.target.value })} /></Field>
            <Field label="Subcontracting preference (if applicable)"><Input value={t.subcontractingPreference ?? ""} onChange={(e) => updateTest(ti, { subcontractingPreference: e.target.value })} /></Field>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => onChange({ ...s, tests: [...s.tests, emptyTestRequest()] })}>
          <Plus className="h-3.5 w-3.5" /> Add requested test
        </Button>
      </CardContent>

      <CardContent className="flex gap-2 border-t border-[var(--border-soft)]">
        <Button size="sm" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save sample"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </CardContent>
    </Card>
  );
}

export function SampleSummaryRow({ sample, onEdit, onRemove, focus }: { sample: TrfSampleInput & { id: string }; onEdit: () => void; onRemove: () => void; focus: "identity" | "tests" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{sample.sampleName || "Untitled sample"}</p>
        {focus === "identity" ? (
          <p className="text-xs text-slate-500">{sample.productCategory} · {sample.quantity} {sample.quantityUnit} · {sample.containers} container(s)</p>
        ) : (
          <p className="text-xs text-slate-500">{sample.tests.length} requested test{sample.tests.length === 1 ? "" : "s"}: {sample.tests.map((t) => t.customRequest ? t.customServiceName : t.requestedParameter).filter(Boolean).join(", ") || "None yet"}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
