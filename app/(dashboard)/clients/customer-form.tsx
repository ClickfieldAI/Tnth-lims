"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Divider } from "@/components/ui/forms";
import { createCustomerAction, updateCustomerAction } from "@/actions/customers";
import {
  CUSTOMER_TYPES, GST_STATUSES, COMM_METHODS, DELIVERY_METHODS,
  emptyCustomerInput, type CustomerInput, type FieldErrors,
} from "@/lib/customers/validation";

function set<K extends keyof CustomerInput>(setter: React.Dispatch<React.SetStateAction<CustomerInput>>, key: K, value: CustomerInput[K]) {
  setter((prev) => ({ ...prev, [key]: value }));
}

export function CustomerForm({ mode, customerId, initial }: { mode: "create" | "edit"; customerId?: string; initial?: CustomerInput }) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerInput>(initial ?? emptyCustomerInput());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ field: string; id: string; code: string; name: string }[] | null>(null);
  const [pending, startTransition] = useTransition();

  function err(key: string) {
    return errors[key] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[key]}</p> : null;
  }

  function submit(confirmDuplicate: boolean) {
    setFormError(null);
    setErrors({});
    startTransition(async () => {
      const res = mode === "create"
        ? await createCustomerAction(form, confirmDuplicate)
        : await updateCustomerAction(customerId!, form, confirmDuplicate);

      if (res.ok) {
        setDuplicates(null);
        router.push(`/clients/${res.id}`);
        router.refresh();
        return;
      }
      if (res.fieldErrors) setErrors(res.fieldErrors);
      if (res.duplicates?.length) { setDuplicates(res.duplicates); return; }
      setFormError(res.error ?? "Something went wrong.");
    });
  }

  const billing = form.billing;
  const reporting = form.reporting;

  return (
    <div className="space-y-5">
      {duplicates ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-amber-900">Possible duplicate customer</p>
              <ul className="space-y-1 text-xs text-amber-800">
                {duplicates.map((d, i) => (
                  <li key={i}>Matches {d.field} of <strong>{d.code} — {d.name}</strong></li>
                ))}
              </ul>
              <p className="text-xs text-amber-700">Review the existing record before continuing. This will create a separate record — no records are merged automatically.</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => submit(true)} disabled={pending}>Create anyway</Button>
                <Button size="sm" variant="ghost" onClick={() => setDuplicates(null)}>Go back and edit</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* A. Identification */}
      <Card>
        <CardHeader title="A. Identification" subtitle="Core customer identity" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer type" required hint={err("customerType") ? undefined : undefined}>
            <Select value={form.customerType} onChange={(e) => set(setForm, "customerType", e.target.value)}>
              {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            {err("customerType")}
          </Field>
          <Field label="Active">
            <Select value={form.active ? "yes" : "no"} onChange={(e) => set(setForm, "active", e.target.value === "yes")}>
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </Select>
          </Field>
          <Field label="Company / customer name" required>
            <Input value={form.name} onChange={(e) => set(setForm, "name", e.target.value)} placeholder="e.g. Sundar Pharma Formulations" />
            {err("name")}
          </Field>
          <Field label="Trade name (optional)">
            <Input value={form.tradeName} onChange={(e) => set(setForm, "tradeName", e.target.value)} />
          </Field>
          <Field label="Industry / sector">
            <Input value={form.industry} onChange={(e) => set(setForm, "industry", e.target.value)} placeholder="e.g. Food Testing" />
          </Field>
        </CardContent>
      </Card>

      {/* B. Primary Contact */}
      <Card>
        <CardHeader title="B. Primary Contact" subtitle="Who we coordinate with day to day" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person" required>
            <Input value={form.contactPerson} onChange={(e) => set(setForm, "contactPerson", e.target.value)} />
            {err("contactPerson")}
          </Field>
          <Field label="Designation">
            <Input value={form.designation} onChange={(e) => set(setForm, "designation", e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => set(setForm, "email", e.target.value)} />
            {err("email")}
          </Field>
          <Field label="Mobile number" required>
            <Input value={form.phone} onChange={(e) => set(setForm, "phone", e.target.value)} placeholder="10-digit or +country code" />
            {err("phone")}
          </Field>
          <Field label="Alternate phone">
            <Input value={form.alternatePhone} onChange={(e) => set(setForm, "alternatePhone", e.target.value)} />
            {err("alternatePhone")}
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={(e) => set(setForm, "website", e.target.value)} placeholder="https://…" />
            {err("website")}
          </Field>
        </CardContent>
      </Card>

      {/* C. Billing address */}
      <Card>
        <CardHeader title="C. Billing Address" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" required>
            <Input value={billing.line1} onChange={(e) => set(setForm, "billing", { ...billing, line1: e.target.value })} />
            {err("billing.line1")}
          </Field>
          <Field label="Address line 2">
            <Input value={billing.line2} onChange={(e) => set(setForm, "billing", { ...billing, line2: e.target.value })} />
          </Field>
          <Field label="City" required>
            <Input value={billing.city} onChange={(e) => set(setForm, "billing", { ...billing, city: e.target.value })} />
            {err("billing.city")}
          </Field>
          <Field label="District">
            <Input value={billing.district} onChange={(e) => set(setForm, "billing", { ...billing, district: e.target.value })} />
          </Field>
          <Field label="State" required>
            <Input value={billing.state} onChange={(e) => set(setForm, "billing", { ...billing, state: e.target.value })} />
            {err("billing.state")}
          </Field>
          <Field label="PIN code" required>
            <Input value={billing.pin} onChange={(e) => set(setForm, "billing", { ...billing, pin: e.target.value })} />
            {err("billing.pin")}
          </Field>
          <Field label="Country" required>
            <Input value={billing.country} onChange={(e) => set(setForm, "billing", { ...billing, country: e.target.value })} />
            {err("billing.country")}
          </Field>
        </CardContent>
      </Card>

      {/* D. Reporting address */}
      <Card>
        <CardHeader
          title="D. Reporting Address"
          subtitle="Where test reports & certificates are sent"
          action={
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={form.reportingSameAsBilling}
                onChange={(e) => set(setForm, "reportingSameAsBilling", e.target.checked)}
              />
              Same as billing address
            </label>
          }
        />
        {!form.reportingSameAsBilling ? (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact person">
              <Input value={reporting.contactPerson} onChange={(e) => set(setForm, "reporting", { ...reporting, contactPerson: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={reporting.email} onChange={(e) => set(setForm, "reporting", { ...reporting, email: e.target.value })} />
              {err("reporting.email")}
            </Field>
            <Field label="Phone">
              <Input value={reporting.phone} onChange={(e) => set(setForm, "reporting", { ...reporting, phone: e.target.value })} />
              {err("reporting.phone")}
            </Field>
            <Field label="Address line 1">
              <Input value={reporting.line1} onChange={(e) => set(setForm, "reporting", { ...reporting, line1: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={reporting.city} onChange={(e) => set(setForm, "reporting", { ...reporting, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={reporting.state} onChange={(e) => set(setForm, "reporting", { ...reporting, state: e.target.value })} />
            </Field>
            <Field label="PIN code">
              <Input value={reporting.pin} onChange={(e) => set(setForm, "reporting", { ...reporting, pin: e.target.value })} />
              {err("reporting.pin")}
            </Field>
            <Field label="Country">
              <Input value={reporting.country} onChange={(e) => set(setForm, "reporting", { ...reporting, country: e.target.value })} />
            </Field>
          </CardContent>
        ) : (
          <CardContent><p className="text-xs text-slate-400">Using the billing address above.</p></CardContent>
        )}
      </Card>

      {/* E. Business & tax */}
      <Card>
        <CardHeader title="E. Business & Tax Information" subtitle="GST / PAN are optional — no tax is calculated here" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="GST registration status">
            <Select value={form.gstStatus} onChange={(e) => set(setForm, "gstStatus", e.target.value)}>
              {GST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            {err("gstStatus")}
          </Field>
          <div />
          <Field label="GST number" hint="Format: 33ABCDE1234F1Z5">
            <Input value={form.gstNumber} onChange={(e) => set(setForm, "gstNumber", e.target.value.toUpperCase())} />
            {err("gstNumber")}
          </Field>
          <Field label="PAN number" hint="Format: ABCDE1234F">
            <Input value={form.panNumber} onChange={(e) => set(setForm, "panNumber", e.target.value.toUpperCase())} />
            {err("panNumber")}
          </Field>
          <Field label="Billing terms">
            <Input value={form.billingTerms} onChange={(e) => set(setForm, "billingTerms", e.target.value)} placeholder="e.g. Net 30" />
          </Field>
          <Field label="PO reference required">
            <Select value={form.poRequired ? "yes" : "no"} onChange={(e) => set(setForm, "poRequired", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </Field>
          {form.poRequired ? (
            <Field label="Default PO reference">
              <Input value={form.poReference} onChange={(e) => set(setForm, "poReference", e.target.value)} />
            </Field>
          ) : null}
          <Field label="Tax notes">
            <Textarea value={form.taxNotes} onChange={(e) => set(setForm, "taxNotes", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* F. Preferences */}
      <Card>
        <CardHeader title="F. Preferences" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred communication method">
            <Select value={form.preferredComm} onChange={(e) => set(setForm, "preferredComm", e.target.value)}>
              {COMM_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Preferred report delivery">
            <Select value={form.preferredDelivery} onChange={(e) => set(setForm, "preferredDelivery", e.target.value)}>
              {DELIVERY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Sample handling instructions" hint="e.g. cold-chain, special packaging">
            <Textarea value={form.handlingInstructions} onChange={(e) => set(setForm, "handlingInstructions", e.target.value)} />
          </Field>
          <Field label="Standard testing requirements">
            <Textarea value={form.testingRequirements} onChange={(e) => set(setForm, "testingRequirements", e.target.value)} />
          </Field>
          <Field label="Reporting instructions" hint="e.g. format, cc list">
            <Textarea value={form.reportingInstructions} onChange={(e) => set(setForm, "reportingInstructions", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* G. Notes (documents are managed after the record exists, from the details page) */}
      <Card>
        <CardHeader title="G. Notes" />
        <CardContent>
          <Field label="Internal notes">
            <Textarea value={form.notes} onChange={(e) => set(setForm, "notes", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {mode === "create" ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="text-xs text-slate-500">
            Documents & attachments can be added from the customer's details page once the record is created.
          </CardContent>
        </Card>
      ) : null}

      {formError ? <p className="text-sm font-medium text-rose-600">{formError}</p> : null}

      <Divider />
      <CardFooter className="flex gap-2 border-none px-0">
        <Button onClick={() => submit(false)} disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create customer" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </CardFooter>
    </div>
  );
}
