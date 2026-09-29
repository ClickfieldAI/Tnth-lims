"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Divider } from "@/components/ui/forms";
import { updateQuotationDraftAction } from "@/actions/enquiries";
import { TAX_CATEGORIES, taxRateFor, type QuotationDraftInput, type QuotationItemInput } from "@/lib/enquiries/validation";
import { formatCurrency } from "@/lib/utils";

export function QuotationDraftForm({ quotationId, initial }: { quotationId: string; initial: QuotationDraftInput }) {
  const router = useRouter();
  const [form, setForm] = useState<QuotationDraftInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function err(key: string) {
    return errors[key] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[key]}</p> : null;
  }

  function updateItem(i: number, patch: Partial<QuotationItemInput>) {
    setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  }

  const totals = useMemo(() => {
    let subtotal = 0, lineDiscount = 0, tax = 0;
    for (const it of form.items) {
      const lineSub = it.quantity * it.unitPrice;
      const disc = Math.min(it.discount, lineSub);
      subtotal += lineSub;
      lineDiscount += disc;
      const rate = taxRateFor(it.taxCategory);
      tax += rate ? (lineSub - disc) * (rate / 100) : 0;
    }
    const overallDisc = Math.min(form.discountTotal, Math.max(0, subtotal - lineDiscount));
    const taxable = Math.max(0, subtotal - lineDiscount - overallDisc);
    return { subtotal, discountTotal: lineDiscount + overallDisc, taxable, tax, grand: taxable + tax };
  }, [form]);

  function submit() {
    setFormError(null); setErrors({});
    startTransition(async () => {
      const res = await updateQuotationDraftAction(quotationId, form);
      if (res.ok) { router.push(`/quotations/${quotationId}`); router.refresh(); return; }
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Quotation Terms" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Valid until" required>
            <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            {err("validUntil")}
          </Field>
          <Field label="Payment terms"><Input value={form.paymentTerms ?? ""} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
          <Field label="Advance payment required">
            <Select value={form.advancePaymentRequired ? "yes" : "no"} onChange={(e) => setForm({ ...form, advancePaymentRequired: e.target.value === "yes" })}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Select>
          </Field>
          <Field label="PO required">
            <Select value={form.poRequired ? "yes" : "no"} onChange={(e) => setForm({ ...form, poRequired: e.target.value === "yes" })}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Select>
          </Field>
          <Field label="Overall discount (₹, applied after line discounts)">
            <Input type="number" min={0} value={form.discountTotal} onChange={(e) => setForm({ ...form, discountTotal: Number(e.target.value) })} />
            {err("discountTotal")}
          </Field>
          <Field label="Billing notes"><Textarea value={form.billingNotes ?? ""} onChange={(e) => setForm({ ...form, billingNotes: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Line Items" subtitle="One per requested testing service — prices must be entered manually" />
        <CardContent className="space-y-3">
          {err("items")}
          {form.items.map((it, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
              <div className="sm:col-span-6 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">{it.productReference} — {it.serviceName}</p>
                <button type="button" className="text-xs text-rose-500" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}><Trash2 className="inline h-3.5 w-3.5" /> Remove</button>
              </div>
              <Field label="Method"><Input value={it.method ?? ""} onChange={(e) => updateItem(i, { method: e.target.value })} /></Field>
              <Field label="Quantity" required>
                <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                {err(`items.${i}.quantity`)}
              </Field>
              <Field label="Unit price (₹)" required>
                <Input type="number" min={0} value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })} />
                {err(`items.${i}.unitPrice`)}
              </Field>
              <Field label="Discount (₹)">
                <Input type="number" min={0} value={it.discount} onChange={(e) => updateItem(i, { discount: Number(e.target.value) })} />
                {err(`items.${i}.discount`)}
              </Field>
              <Field label="Tax category">
                <Select value={it.taxCategory} onChange={(e) => updateItem(i, { taxCategory: e.target.value })}>
                  {TAX_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Est. TAT (days)"><Input type="number" min={0} value={it.estimatedTurnaroundDays ?? ""} onChange={(e) => updateItem(i, { estimatedTurnaroundDays: Number(e.target.value) })} /></Field>
              <div className="sm:col-span-6 text-right text-xs text-slate-500">
                Line total: <span className="font-semibold text-slate-800">
                  {formatCurrency(Math.max(0, it.quantity * it.unitPrice - it.discount) * (1 + (taxRateFor(it.taxCategory) ?? 0) / 100), "INR")}
                </span>
              </div>
            </div>
          ))}
          <Button
            size="sm" variant="secondary"
            onClick={() => setForm({ ...form, items: [...form.items, { productReference: "Additional item", serviceName: "", quantity: 1, unitPrice: 0, discount: 0, taxCategory: "Pending Configuration" }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add line item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Computed totals (server-recalculated on save)" />
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subtotal, "INR")}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatCurrency(totals.discountTotal, "INR")}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Taxable amount</span><span>{formatCurrency(totals.taxable, "INR")}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{formatCurrency(totals.tax, "INR")}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><span>Grand total</span><span>{formatCurrency(totals.grand, "INR")}</span></div>
        </CardContent>
      </Card>

      {formError ? <p className="text-sm font-medium text-rose-600">{formError}</p> : null}
      <Divider />
      <CardFooter className="flex gap-2 border-none px-0">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save draft"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </CardFooter>
    </div>
  );
}
