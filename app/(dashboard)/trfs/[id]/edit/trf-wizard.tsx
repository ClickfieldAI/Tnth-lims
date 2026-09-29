"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Trash2, Check } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { Badge } from "@/components/ui/badge";
import {
  addTrfSampleAction, updateTrfSampleAction, removeTrfSampleAction,
  addTrfDocumentAction, removeTrfDocumentAction, setTrfAuthorizationAction, updateTrfDraftAction, submitTrfAction,
} from "@/actions/trfs";
import { SampleForm, SampleSummaryRow } from "../../sample-form";
import {
  TRF_PRIORITIES, STORAGE_CONDITIONS, AUTHORIZATION_METHODS, TRF_DOC_TYPES,
  emptySample, validateStep2, validateStep3, validateStep4, validateAuthorization,
  type TrfSampleInput, type TrfAuthorizationInput, type FieldErrors,
} from "@/lib/trfs/validation";
import { formatCurrency } from "@/lib/utils";

type SampleWithId = TrfSampleInput & { id: string };

export interface TrfWizardProps {
  trfId: string;
  customerSummary: { code: string; name: string; contactPerson: string };
  quotationSummary: { quotationCode: string; grandTotal: number; paymentTerms: string };
  initialSamples: SampleWithId[];
  initialDocuments: { id: string; docType: string; fileName: string; sizeBytes: number }[];
  initialStep4: {
    priority: string; requestedDueDate: string; agreedTurnaroundDays?: number; specialDeadlineInstructions?: string;
    storageCondition: string; storageTemperature?: string; specialHandlingInstructions?: string; lightSensitive: boolean;
    moistureSensitive: boolean; otherStorageNotes?: string; reportRecipient?: string; reportEmail?: string; reportingUnits?: string;
    reportLanguage?: string; conformityStatementRequested: boolean; applicableSpecification?: string; reportingInstructions?: string;
  };
  initialAuthorization: TrfAuthorizationInput;
}

const STEPS = ["Customer & Commercial", "Sample Information", "Testing Requirements", "Storage & Reporting", "Documents", "Review & Submit"];

export function TrfWizard(props: TrfWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(2);
  const [samples, setSamples] = useState<SampleWithId[]>(props.initialSamples);
  const [documents, setDocuments] = useState(props.initialDocuments);
  const [step4, setStep4] = useState(props.initialStep4);
  const [authorization, setAuthorization] = useState<TrfAuthorizationInput>(props.initialAuthorization);
  const [editingSample, setEditingSample] = useState<{ index: number | null; value: TrfSampleInput } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasSignedTrf = documents.some((d) => d.docType === "Signed TRF");

  function goStep(n: number) {
    setFormError(null); setErrors({});
    if (n === 3 || n === 4 || n === 6) {
      const e = n === 3 ? validateStep2(samples) : n === 4 ? validateStep3(samples) : {};
      if (Object.keys(e).length) { setErrors(e); setFormError("Please complete the current step before continuing."); return; }
    }
    setStep(n);
  }

  function saveSample() {
    if (!editingSample) return;
    const value = editingSample.value;
    // The server always validates a sample together with its tests as one
    // unit, so both are validated here before attempting to save.
    const stepErrors = { ...validateStep2([value]), ...validateStep3([value]) };
    if (Object.keys(stepErrors).length) return setErrors(stepErrors);
    setErrors({});
    startTransition(async () => {
      if (editingSample.index === null) {
        const res = await addTrfSampleAction(props.trfId, value);
        if (!res.ok) return setFormError(res.error ?? "Failed to add sample.");
        setSamples((prev) => [...prev, { ...value, id: res.id! }]);
      } else {
        const existing = samples[editingSample.index];
        const res = await updateTrfSampleAction(props.trfId, existing.id, value);
        if (!res.ok) return setFormError(res.error ?? "Failed to update sample.");
        setSamples((prev) => prev.map((s, i) => (i === editingSample.index ? { ...value, id: existing.id } : s)));
      }
      setEditingSample(null);
    });
  }

  function removeSample(index: number) {
    const sample = samples[index];
    startTransition(async () => {
      const res = await removeTrfSampleAction(props.trfId, sample.id);
      if (!res.ok) return setFormError(res.error ?? "Failed to remove sample.");
      setSamples((prev) => prev.filter((_, i) => i !== index));
    });
  }

  function saveStep4() {
    const e = validateStep4({ ...step4, customerId: "", quotationId: "", samples: [], authorization: { status: "NOT_AUTHORIZED" } });
    if (Object.keys(e).length) return setErrors(e);
    setErrors({}); setFormError(null);
    startTransition(async () => {
      const res = await updateTrfDraftAction(props.trfId, step4);
      if (!res.ok) return setFormError(res.error ?? "Failed to save.");
      goStep(5);
    });
  }

  function saveAuthorization() {
    startTransition(async () => {
      const res = await setTrfAuthorizationAction(props.trfId, authorization);
      if (!res.ok) return setFormError(res.error ?? "Failed to save authorization.");
    });
  }

  function submit() {
    setFormError(null); setErrors({});
    const authErrors = validateAuthorization(authorization, hasSignedTrf);
    if (Object.keys(authErrors).length) { setErrors(authErrors); setFormError("Customer authorization must be completed before submission."); return; }
    startTransition(async () => {
      const res = await submitTrfAction(props.trfId);
      if (!res.ok) { setFormError(res.error ?? "Submission failed."); if (res.fieldErrors) setErrors(res.fieldErrors); return; }
      router.push(`/trfs/${props.trfId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <button
              key={label}
              onClick={() => goStep(n)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                n === step ? "border-brand-600 bg-brand-50 text-brand-700" : n < step ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"
              }`}
            >
              {n < step ? <Check className="mr-1 inline h-3 w-3" /> : null}{n}. {label}
            </button>
          );
        })}
      </div>

      {formError ? <p className="text-sm font-medium text-rose-600">{formError}</p> : null}

      {step === 1 ? (
        <Card>
          <CardHeader title="Customer & Commercial Details" />
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><p className="text-[11px] text-slate-400">Customer</p><p>{props.customerSummary.code} — {props.customerSummary.name}</p></div>
            <div><p className="text-[11px] text-slate-400">Contact</p><p>{props.customerSummary.contactPerson}</p></div>
            <div><p className="text-[11px] text-slate-400">Quotation</p><p>{props.quotationSummary.quotationCode}</p></div>
            <div><p className="text-[11px] text-slate-400">Accepted charges (snapshot)</p><p>{formatCurrency(props.quotationSummary.grandTotal, "INR")}</p></div>
          </CardContent>
          <CardContent className="text-xs text-slate-400">These commercial details are fixed once the TRF draft is created and cannot be changed here.</CardContent>
        </Card>
      ) : null}

      {step === 2 || step === 3 ? (
        <div className="space-y-3">
          {editingSample ? (
            <SampleForm
              value={editingSample.value}
              onChange={(v) => setEditingSample({ ...editingSample, value: v })}
              onSave={saveSample}
              onCancel={() => setEditingSample(null)}
              errors={errors}
              saving={pending}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{samples.length} sample{samples.length === 1 ? "" : "s"} on this TRF</p>
                {step === 2 ? (
                  <Button size="sm" onClick={() => setEditingSample({ index: null, value: emptySample() })}>
                    <Plus className="h-3.5 w-3.5" /> Add Sample
                  </Button>
                ) : null}
              </div>
              {errors.samples ? <p className="text-xs font-medium text-rose-600">{errors.samples}</p> : null}
              <div className="space-y-2">
                {samples.map((s, i) => (
                  <SampleSummaryRow key={s.id} sample={s} focus={step === 2 ? "identity" : "tests"} onEdit={() => setEditingSample({ index: i, value: s })} onRemove={() => removeSample(i)} />
                ))}
                {!samples.length ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">No samples added yet.</p> : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader title="Storage & Reporting Requirements" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Storage condition" required>
              <Select value={step4.storageCondition} onChange={(e) => setStep4({ ...step4, storageCondition: e.target.value })}>
                {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              {errors.storageCondition ? <p className="mt-1 text-[11px] text-rose-600">{errors.storageCondition}</p> : null}
            </Field>
            <Field label="Required storage temperature / range"><Input value={step4.storageTemperature ?? ""} onChange={(e) => setStep4({ ...step4, storageTemperature: e.target.value })} /></Field>
            <Field label="Special handling instructions"><Textarea value={step4.specialHandlingInstructions ?? ""} onChange={(e) => setStep4({ ...step4, specialHandlingInstructions: e.target.value })} /></Field>
            <Field label="Other storage requirements"><Textarea value={step4.otherStorageNotes ?? ""} onChange={(e) => setStep4({ ...step4, otherStorageNotes: e.target.value })} /></Field>
            <Field label="Light-sensitive">
              <Select value={step4.lightSensitive ? "yes" : "no"} onChange={(e) => setStep4({ ...step4, lightSensitive: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></Select>
            </Field>
            <Field label="Moisture-sensitive">
              <Select value={step4.moistureSensitive ? "yes" : "no"} onChange={(e) => setStep4({ ...step4, moistureSensitive: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></Select>
            </Field>

            <Field label="Report recipient"><Input value={step4.reportRecipient ?? ""} onChange={(e) => setStep4({ ...step4, reportRecipient: e.target.value })} /></Field>
            <Field label="Report email">
              <Input value={step4.reportEmail ?? ""} onChange={(e) => setStep4({ ...step4, reportEmail: e.target.value })} />
              {errors.reportEmail ? <p className="mt-1 text-[11px] text-rose-600">{errors.reportEmail}</p> : null}
            </Field>
            <Field label="Required reporting units"><Input value={step4.reportingUnits ?? ""} onChange={(e) => setStep4({ ...step4, reportingUnits: e.target.value })} /></Field>
            <Field label="Report language"><Input value={step4.reportLanguage ?? ""} onChange={(e) => setStep4({ ...step4, reportLanguage: e.target.value })} /></Field>
            <Field label="Conformity statement requested">
              <Select value={step4.conformityStatementRequested ? "yes" : "no"} onChange={(e) => setStep4({ ...step4, conformityStatementRequested: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></Select>
            </Field>
            <Field label="Applicable specification"><Input value={step4.applicableSpecification ?? ""} onChange={(e) => setStep4({ ...step4, applicableSpecification: e.target.value })} /></Field>
            <Field label="Customer-specific reporting instructions"><Textarea value={step4.reportingInstructions ?? ""} onChange={(e) => setStep4({ ...step4, reportingInstructions: e.target.value })} /></Field>

            <Field label="Priority" required>
              <Select value={step4.priority} onChange={(e) => setStep4({ ...step4, priority: e.target.value })}>
                {TRF_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Requested due date" required hint="The final achievable due date is confirmed during technical review, not guaranteed here.">
              <Input type="date" value={step4.requestedDueDate} onChange={(e) => setStep4({ ...step4, requestedDueDate: e.target.value })} />
              {errors.requestedDueDate ? <p className="mt-1 text-[11px] text-rose-600">{errors.requestedDueDate}</p> : null}
            </Field>
            <Field label="Special deadline instructions"><Textarea value={step4.specialDeadlineInstructions ?? ""} onChange={(e) => setStep4({ ...step4, specialDeadlineInstructions: e.target.value })} /></Field>
          </CardContent>
          <CardContent className="flex gap-2 border-t border-[var(--border-soft)]">
            <Button onClick={saveStep4} disabled={pending}>{pending ? "Saving…" : "Save & continue"}</Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? <DocumentsStep trfId={props.trfId} documents={documents} setDocuments={setDocuments} onContinue={() => goStep(6)} /> : null}

      {step === 6 ? (
        <ReviewStep
          customerSummary={props.customerSummary} quotationSummary={props.quotationSummary} samples={samples} step4={step4}
          documents={documents} authorization={authorization} setAuthorization={setAuthorization} hasSignedTrf={hasSignedTrf}
          errors={errors} onSaveAuthorization={saveAuthorization} onSubmit={submit} pending={pending} onEditStep={goStep}
        />
      ) : null}
    </div>
  );
}

function DocumentsStep({ trfId, documents, setDocuments, onContinue }: {
  trfId: string; documents: { id: string; docType: string; fileName: string; sizeBytes: number }[];
  setDocuments: React.Dispatch<React.SetStateAction<{ id: string; docType: string; fileName: string; sizeBytes: number }[]>>;
  onContinue: () => void;
}) {
  const [docType, setDocType] = useState<string>(TRF_DOC_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a file to upload.");
    setError(null);
    startTransition(async () => {
      const res = await addTrfDocumentAction(trfId, { docType, fileName: file.name, sizeBytes: file.size, mimeType: file.type });
      if (!res.ok) return setError(res.error ?? "Upload failed.");
      setDocuments((prev) => [...prev, { id: crypto.randomUUID(), docType, fileName: file.name, sizeBytes: file.size }]);
      if (fileRef.current) fileRef.current.value = "";
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await removeTrfDocumentAction(trfId, id);
      if (!res.ok) return setError(res.error ?? "Failed to remove document.");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    });
  }

  return (
    <Card>
      <CardHeader title="Supporting Documents" subtitle="Metadata-only — no persistent file storage is wired up in this environment" />
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Document type">
            <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {TRF_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" className="text-sm" />
          <Button size="sm" onClick={upload} disabled={pending}><Upload className="h-3.5 w-3.5" /> Upload</Button>
        </div>
        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span><Badge tone="indigo">{d.docType}</Badge> <span className="ml-2 font-mono text-xs">{d.fileName}</span> <span className="text-xs text-slate-400">({(d.sizeBytes / 1024).toFixed(0)} KB)</span></span>
              <button className="text-rose-500" onClick={() => remove(d.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {!documents.length ? <p className="text-xs text-slate-400">No documents uploaded yet.</p> : null}
        </div>
      </CardContent>
      <CardContent className="border-t border-[var(--border-soft)]"><Button onClick={onContinue}>Continue to review</Button></CardContent>
    </Card>
  );
}

function ReviewStep({
  customerSummary, quotationSummary, samples, step4, documents, authorization, setAuthorization, hasSignedTrf, errors, onSaveAuthorization, onSubmit, pending, onEditStep,
}: {
  customerSummary: TrfWizardProps["customerSummary"]; quotationSummary: TrfWizardProps["quotationSummary"];
  samples: SampleWithId[]; step4: TrfWizardProps["initialStep4"]; documents: { id: string; docType: string; fileName: string }[];
  authorization: TrfAuthorizationInput; setAuthorization: (a: TrfAuthorizationInput) => void; hasSignedTrf: boolean;
  errors: FieldErrors; onSaveAuthorization: () => void; onSubmit: () => void; pending: boolean; onEditStep: (n: number) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Review" action={<Button size="sm" variant="ghost" onClick={() => onEditStep(1)}>Edit</Button>} />
        <CardContent className="text-sm"><p>{customerSummary.code} — {customerSummary.name} · Quotation {quotationSummary.quotationCode}</p></CardContent>
      </Card>
      <Card>
        <CardHeader title={`Samples (${samples.length})`} action={<Button size="sm" variant="ghost" onClick={() => onEditStep(2)}>Edit</Button>} />
        <CardContent className="space-y-2 text-sm">
          {samples.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold">{s.sampleName}</p>
              <p className="text-xs text-slate-500">{s.tests.length} test(s): {s.tests.map((t) => t.customRequest ? t.customServiceName : t.requestedParameter).join(", ")}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Storage & Reporting" action={<Button size="sm" variant="ghost" onClick={() => onEditStep(4)}>Edit</Button>} />
        <CardContent className="text-sm text-slate-600">
          {step4.storageCondition} · Priority {step4.priority} · Due {step4.requestedDueDate || "—"}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={`Documents (${documents.length})`} action={<Button size="sm" variant="ghost" onClick={() => onEditStep(5)}>Edit</Button>} />
        <CardContent className="text-xs text-slate-500">{documents.map((d) => d.fileName).join(", ") || "None"}</CardContent>
      </Card>

      <Card className="border-amber-300">
        <CardHeader title="Customer Authorization" subtitle="Required before submission" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Authorization status">
            <Select value={authorization.status} onChange={(e) => setAuthorization({ ...authorization, status: e.target.value as "NOT_AUTHORIZED" | "AUTHORIZED" })}>
              <option value="NOT_AUTHORIZED">Not yet authorized</option>
              <option value="AUTHORIZED">Authorized</option>
            </Select>
          </Field>
          <Field label="Authorization method">
            <Select value={authorization.authorizationMethod ?? ""} onChange={(e) => setAuthorization({ ...authorization, authorizationMethod: e.target.value })}>
              <option value="">Select…</option>
              {AUTHORIZATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            {errors.authorizationMethod ? <p className="mt-1 text-[11px] text-rose-600">{errors.authorizationMethod}</p> : null}
            {authorization.authorizationMethod === "Signed TRF Upload" && !hasSignedTrf ? <p className="mt-1 text-[11px] text-amber-700">Upload a &quot;Signed TRF&quot; document in the previous step first.</p> : null}
          </Field>
          <Field label="Authorized person's name" required>
            <Input value={authorization.authorizedPersonName ?? ""} onChange={(e) => setAuthorization({ ...authorization, authorizedPersonName: e.target.value })} />
            {errors.authorizedPersonName ? <p className="mt-1 text-[11px] text-rose-600">{errors.authorizedPersonName}</p> : null}
          </Field>
          <Field label="Designation"><Input value={authorization.authorizedPersonDesignation ?? ""} onChange={(e) => setAuthorization({ ...authorization, authorizedPersonDesignation: e.target.value })} /></Field>
          <Field label="Authorization date"><Input type="date" value={authorization.authorizationDate ?? ""} onChange={(e) => setAuthorization({ ...authorization, authorizationDate: e.target.value })} /></Field>
          <Field label="Authorization notes"><Textarea value={authorization.notes ?? ""} onChange={(e) => setAuthorization({ ...authorization, notes: e.target.value })} /></Field>
        </CardContent>
        <CardContent className="text-[11px] text-amber-700">
          Uploading a file alone does not constitute a legally valid electronic signature — this records staff-confirmed authorization evidence only.
        </CardContent>
        <CardContent className="border-t border-[var(--border-soft)]">
          <Button size="sm" variant="secondary" onClick={onSaveAuthorization} disabled={pending}>Save authorization</Button>
        </CardContent>
      </Card>

      {errors.status ? <p className="text-sm font-medium text-rose-600">{errors.status}</p> : null}
      <Button onClick={onSubmit} disabled={pending}>{pending ? "Submitting…" : "Submit TRF"}</Button>
    </div>
  );
}
