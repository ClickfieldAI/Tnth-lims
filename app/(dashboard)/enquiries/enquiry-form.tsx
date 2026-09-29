"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Divider } from "@/components/ui/forms";
import { createEnquiryAction, updateEnquiryAction } from "@/actions/enquiries";
import { FOOD_TESTING_SERVICES } from "@/lib/enquiries/catalog";
import {
  ENQUIRY_SOURCES, ENQUIRY_PRIORITIES, emptyEnquiryInput, emptyProduct, emptyTestRequest,
  type EnquiryInput, type FieldErrors,
} from "@/lib/enquiries/validation";

export interface CustomerOption {
  id: string; code: string; name: string; contactPerson: string; email: string; phone: string;
  isActive: boolean; billing?: { line1?: string; city?: string; state?: string; pin?: string; country?: string };
}

export function EnquiryForm({
  mode, enquiryId, initial, customers, managers,
}: {
  mode: "create" | "edit";
  enquiryId?: string;
  initial?: EnquiryInput;
  customers: CustomerOption[];
  managers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<EnquiryInput>(initial ?? emptyEnquiryInput());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [customerQuery, setCustomerQuery] = useState("");

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === form.customerId), [customers, form.customerId]);
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const pool = customers.filter((c) => c.isActive || c.id === form.customerId);
    if (!q) return pool.slice(0, 8);
    return pool.filter((c) => [c.code, c.name, c.contactPerson].some((v) => v.toLowerCase().includes(q))).slice(0, 8);
  }, [customers, customerQuery, form.customerId]);

  function err(key: string) {
    return errors[key] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[key]}</p> : null;
  }

  function updateProduct(pi: number, patch: Partial<EnquiryInput["products"][number]>) {
    setForm((f) => ({ ...f, products: f.products.map((p, i) => (i === pi ? { ...p, ...patch } : p)) }));
  }
  function updateTest(pi: number, ti: number, patch: Partial<EnquiryInput["products"][number]["tests"][number]>) {
    setForm((f) => ({
      ...f,
      products: f.products.map((p, i) => i === pi ? { ...p, tests: p.tests.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : p),
    }));
  }

  function submit() {
    setFormError(null); setErrors({});
    startTransition(async () => {
      const res = mode === "create" ? await createEnquiryAction(form) : await updateEnquiryAction(enquiryId!, form);
      if (res.ok) { router.push(`/enquiries/${res.id}`); router.refresh(); return; }
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="space-y-5">
      {/* A. Enquiry identification */}
      <Card>
        <CardHeader title="A. Enquiry Identification" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Enquiry ID"><Input value={mode === "create" ? "System-generated on save" : "—"} disabled /></Field>
          <Field label="Enquiry Date" required>
            <Input type="date" value={form.enquiryDate} onChange={(e) => setForm({ ...form, enquiryDate: e.target.value })} />
            {err("enquiryDate")}
          </Field>
          <Field label="Enquiry Source" required>
            <Select value={form.enquirySource} onChange={(e) => setForm({ ...form, enquirySource: e.target.value })}>
              {ENQUIRY_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Priority" required>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {ENQUIRY_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Assigned Manager" required>
            <Select value={form.assignedManagerId} onChange={(e) => setForm({ ...form, assignedManagerId: e.target.value })}>
              <option value="">Select…</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            {err("assignedManagerId")}
          </Field>
          <Field label="Requested Turnaround Time (days)" required>
            <Input type="number" min={1} value={form.requestedTurnaroundDays} onChange={(e) => setForm({ ...form, requestedTurnaroundDays: Number(e.target.value) })} />
            {err("requestedTurnaroundDays")}
          </Field>
        </CardContent>
      </Card>

      {/* B. Customer */}
      <Card>
        <CardHeader title="B. Customer Information" subtitle="Selected from the existing Customer Master — new customers cannot be created here" />
        <CardContent className="space-y-3">
          {!selectedCustomer ? (
            <Field label="Customer" required>
              <Input placeholder="Search by customer ID, name or contact…" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
              {err("customerId")}
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => setForm({ ...form, customerId: c.id })}
                  >
                    <span><span className="font-mono text-[11px] text-slate-400">{c.code}</span> · {c.name}</span>
                    <span className="text-xs text-slate-400">{c.contactPerson}</span>
                  </button>
                ))}
                {!filteredCustomers.length ? <p className="px-3 py-2 text-xs text-slate-400">No active customers match.</p> : null}
              </div>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-[11px] text-slate-400">Customer</p>
                <p className="text-sm font-semibold text-slate-800">{selectedCustomer.code} — {selectedCustomer.name}</p>
              </div>
              <div className="text-right">
                <Link href={`/clients/${selectedCustomer.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  Open Customer Details <ExternalLink className="h-3 w-3" />
                </Link>
                <div><button type="button" className="text-xs text-slate-400 underline" onClick={() => setForm({ ...form, customerId: "" })}>Change customer</button></div>
              </div>
              <div><p className="text-[11px] text-slate-400">Primary contact</p><p className="text-sm">{selectedCustomer.contactPerson || "—"}</p></div>
              <div><p className="text-[11px] text-slate-400">Email</p><p className="text-sm">{selectedCustomer.email || "—"}</p></div>
              <div><p className="text-[11px] text-slate-400">Phone</p><p className="text-sm">{selectedCustomer.phone || "—"}</p></div>
              <div>
                <p className="text-[11px] text-slate-400">Billing address</p>
                <p className="text-sm">{[selectedCustomer.billing?.line1, selectedCustomer.billing?.city, selectedCustomer.billing?.state].filter(Boolean).join(", ") || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* C & D. Products + requested services */}
      {form.products.map((p, pi) => (
        <Card key={pi}>
          <CardHeader
            title={`C. Product / Sample ${pi + 1}`}
            action={form.products.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, products: form.products.filter((_, i) => i !== pi) })}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            ) : undefined}
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" required>
              <Input value={p.productName} onChange={(e) => updateProduct(pi, { productName: e.target.value })} />
              {err(`products.${pi}.productName`)}
            </Field>
            <Field label="Product category" required>
              <Input value={p.productCategory} onChange={(e) => updateProduct(pi, { productCategory: e.target.value })} />
              {err(`products.${pi}.productCategory`)}
            </Field>
            <Field label="Product description"><Input value={p.productDescription ?? ""} onChange={(e) => updateProduct(pi, { productDescription: e.target.value })} /></Field>
            <Field label="Batch number (optional)"><Input value={p.batchNumber ?? ""} onChange={(e) => updateProduct(pi, { batchNumber: e.target.value })} /></Field>
            <Field label="Sample type"><Input value={p.sampleType ?? ""} onChange={(e) => updateProduct(pi, { sampleType: e.target.value })} /></Field>
            <Field label="Sample matrix"><Input value={p.sampleMatrix ?? ""} onChange={(e) => updateProduct(pi, { sampleMatrix: e.target.value })} /></Field>
            <Field label="Sample quantity">
              <div className="flex gap-2">
                <Input type="number" min={0} value={p.quantity ?? ""} onChange={(e) => updateProduct(pi, { quantity: Number(e.target.value) })} />
                <Input placeholder="unit" className="w-24" value={p.quantityUnit ?? ""} onChange={(e) => updateProduct(pi, { quantityUnit: e.target.value })} />
              </div>
              {err(`products.${pi}.quantity`)}
            </Field>
            <Field label="Customer's requested testing date"><Input type="date" value={p.requestedTestingDate ?? ""} onChange={(e) => updateProduct(pi, { requestedTestingDate: e.target.value })} /></Field>
            <Field label="Packaging details"><Input value={p.packagingDetails ?? ""} onChange={(e) => updateProduct(pi, { packagingDetails: e.target.value })} /></Field>
            <Field label="Storage requirements"><Input value={p.storageRequirements ?? ""} onChange={(e) => updateProduct(pi, { storageRequirements: e.target.value })} /></Field>
            <Field label="Special handling instructions" hint=""><Textarea value={p.specialHandlingInstructions ?? ""} onChange={(e) => updateProduct(pi, { specialHandlingInstructions: e.target.value })} /></Field>
            <Field label="Additional notes"><Textarea value={p.notes ?? ""} onChange={(e) => updateProduct(pi, { notes: e.target.value })} /></Field>
          </CardContent>
          <Divider />
          <CardContent>
            <p className="mb-2 text-sm font-semibold text-slate-700">D. Requested Testing Services</p>
            {err(`products.${pi}.tests`)}
            <div className="space-y-3">
              {p.tests.map((t, ti) => (
                <div key={ti} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input type="checkbox" checked={t.customRequest} onChange={(e) => updateTest(pi, ti, { customRequest: e.target.checked, serviceId: "" })} />
                      Custom request (not in catalog — requires technical review)
                    </label>
                    {p.tests.length > 1 ? (
                      <button type="button" className="text-xs text-rose-500" onClick={() => updateProduct(pi, { tests: p.tests.filter((_, i) => i !== ti) })}>Remove test</button>
                    ) : null}
                  </div>
                  {t.customRequest ? (
                    <Field label="Custom service name" required>
                      <Input value={t.customServiceName ?? ""} onChange={(e) => updateTest(pi, ti, { customServiceName: e.target.value })} />
                      {err(`products.${pi}.tests.${ti}.customServiceName`)}
                    </Field>
                  ) : (
                    <Field label="Service (Food Testing catalog)" required>
                      <Select value={t.serviceId} onChange={(e) => updateTest(pi, ti, { serviceId: e.target.value })}>
                        <option value="">Select…</option>
                        {FOOD_TESTING_SERVICES.map((s) => <option key={s.id} value={s.id}>{s.division}</option>)}
                      </Select>
                      {err(`products.${pi}.tests.${ti}.serviceId`)}
                    </Field>
                  )}
                  <Field label="Requested test / parameter" required>
                    <Input value={t.requestedTest} onChange={(e) => updateTest(pi, ti, { requestedTest: e.target.value })} />
                    {err(`products.${pi}.tests.${ti}.requestedTest`)}
                  </Field>
                  <Field label="Requested method (optional)"><Input value={t.requestedMethod ?? ""} onChange={(e) => updateTest(pi, ti, { requestedMethod: e.target.value })} /></Field>
                  <Field label="Applicable specification / standard"><Input value={t.specification ?? ""} onChange={(e) => updateTest(pi, ti, { specification: e.target.value })} /></Field>
                  <Field label="Number of tests" required>
                    <Input type="number" min={1} value={t.requestedQuantity} onChange={(e) => updateTest(pi, ti, { requestedQuantity: Number(e.target.value) })} />
                    {err(`products.${pi}.tests.${ti}.requestedQuantity`)}
                  </Field>
                  <Field label="Customer's special requirements"><Input value={t.specialRequirements ?? ""} onChange={(e) => updateTest(pi, ti, { specialRequirements: e.target.value })} /></Field>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => updateProduct(pi, { tests: [...p.tests, emptyTestRequest()] })}>
              <Plus className="h-3.5 w-3.5" /> Add requested service
            </Button>
          </CardContent>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setForm({ ...form, products: [...form.products, emptyProduct()] })}>
        <Plus className="h-4 w-4" /> Add another product / sample
      </Button>

      {/* E. Customer requirements */}
      <Card>
        <CardHeader title="E. Customer Requirements" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Purpose of testing"><Textarea value={form.purposeOfTesting ?? ""} onChange={(e) => setForm({ ...form, purposeOfTesting: e.target.value })} /></Field>
          <Field label="Regulatory / compliance requirements"><Textarea value={form.regulatoryRequirements ?? ""} onChange={(e) => setForm({ ...form, regulatoryRequirements: e.target.value })} /></Field>
          <Field label="Required reporting format"><Input value={form.requiredReportingFormat ?? ""} onChange={(e) => setForm({ ...form, requiredReportingFormat: e.target.value })} /></Field>
          <Field label="Required accreditation / scope"><Input value={form.requiredAccreditation ?? ""} onChange={(e) => setForm({ ...form, requiredAccreditation: e.target.value })} /></Field>
          <Field label="Required report delivery method"><Input value={form.reportDeliveryMethod ?? ""} onChange={(e) => setForm({ ...form, reportDeliveryMethod: e.target.value })} /></Field>
          <Field label="Customer notes"><Textarea value={form.customerNotes ?? ""} onChange={(e) => setForm({ ...form, customerNotes: e.target.value })} /></Field>
        </CardContent>
        <CardContent className="text-xs text-slate-400">
          Supporting documents can be attached from the enquiry's details page once saved (metadata-only attachment, same as Customer Master — no file storage backend is wired up).
        </CardContent>
      </Card>

      {formError ? <p className="text-sm font-medium text-rose-600">{formError}</p> : null}
      <Divider />
      <CardFooter className="flex gap-2 border-none px-0">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create enquiry" : "Save changes"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </CardFooter>
    </div>
  );
}
