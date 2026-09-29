"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Divider } from "@/components/ui/forms";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createTrfDraftAction } from "@/actions/trfs";

export interface CustomerOption {
  id: string; code: string; name: string; contactPerson: string; email: string; phone: string; isActive: boolean;
  billing?: { line1?: string; city?: string; state?: string; country?: string };
  reporting?: { line1?: string; city?: string; state?: string; country?: string };
  reportingSameAsBilling?: boolean;
}
export interface EligibleQuotation {
  id: string; quotationCode: string; revisionNumber: number; grandTotal: number; paymentTerms: string; poNumber: string | null; customerId: string;
}

export function NewTrfForm({ customers, quotationsByCustomer }: { customers: CustomerOption[]; quotationsByCustomer: Record<string, EligibleQuotation[]> }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const eligibleQuotations = quotationsByCustomer[customerId] ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = customers.filter((c) => c.isActive);
    if (!q) return pool.slice(0, 8);
    return pool.filter((c) => [c.code, c.name, c.contactPerson].some((v) => v.toLowerCase().includes(q))).slice(0, 8);
  }, [customers, query]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createTrfDraftAction({ customerId, quotationId, poNumber });
      if (!res.ok) return setError(res.error ?? "Failed to create draft TRF.");
      router.push(`/trfs/${res.id}/edit`);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Step 1 — Customer & Commercial Details" subtitle="Select the customer and an accepted quotation for this TRF" />
        <CardContent className="space-y-4">
          {!selectedCustomer ? (
            <Field label="Customer" required>
              <Input placeholder="Search by customer ID, name or contact…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {filtered.map((c) => (
                  <button key={c.id} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setCustomerId(c.id); setQuotationId(""); }}>
                    <span><span className="font-mono text-[11px] text-slate-400">{c.code}</span> · {c.name}</span>
                    <span className="text-xs text-slate-400">{c.contactPerson}</span>
                  </button>
                ))}
                {!filtered.length ? <p className="px-3 py-2 text-xs text-slate-400">No active customers match.</p> : null}
              </div>
            </Field>
          ) : (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div><p className="text-[11px] text-slate-400">Customer ID</p><p className="text-sm font-semibold">{selectedCustomer.code}</p></div>
              <div className="text-right">
                <Link href={`/clients/${selectedCustomer.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">Open Customer Details <ExternalLink className="h-3 w-3" /></Link>
                <div><button type="button" className="text-xs text-slate-400 underline" onClick={() => { setCustomerId(""); setQuotationId(""); }}>Change customer</button></div>
              </div>
              <div><p className="text-[11px] text-slate-400">Company</p><p className="text-sm">{selectedCustomer.name}</p></div>
              <div><p className="text-[11px] text-slate-400">Primary contact</p><p className="text-sm">{selectedCustomer.contactPerson}</p></div>
              <div><p className="text-[11px] text-slate-400">Email</p><p className="text-sm">{selectedCustomer.email}</p></div>
              <div><p className="text-[11px] text-slate-400">Phone</p><p className="text-sm">{selectedCustomer.phone}</p></div>
              <div><p className="text-[11px] text-slate-400">Billing address</p><p className="text-sm">{[selectedCustomer.billing?.line1, selectedCustomer.billing?.city, selectedCustomer.billing?.state].filter(Boolean).join(", ") || "—"}</p></div>
              <div><p className="text-[11px] text-slate-400">Reporting address</p><p className="text-sm">{selectedCustomer.reportingSameAsBilling ? "Same as billing" : [selectedCustomer.reporting?.line1, selectedCustomer.reporting?.city].filter(Boolean).join(", ") || "—"}</p></div>
            </div>
          )}

          {selectedCustomer ? (
            <Field label="Accepted quotation" required hint="Only accepted quotations without an existing active TRF are eligible.">
              {eligibleQuotations.length ? (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {eligibleQuotations.map((q) => (
                    <label key={q.id} className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="flex items-center gap-2">
                        <input type="radio" name="quotation" checked={quotationId === q.id} onChange={() => setQuotationId(q.id)} />
                        <span className="font-mono text-[11px] text-slate-500">{q.quotationCode} (Rev.{q.revisionNumber})</span>
                      </span>
                      <span className="flex items-center gap-3 text-xs text-slate-500">
                        {formatCurrency(q.grandTotal, "INR")}
                        <Link href={`/quotations/${q.id}`} target="_blank" className="text-brand-600 hover:underline">View</Link>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  No eligible accepted quotation is available for this customer. A TRF can only be created from an accepted quotation that doesn&apos;t already have an active TRF.
                </div>
              )}
            </Field>
          ) : null}

          {quotationId ? (
            <Field label="Purchase Order number / reference (optional)">
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder={eligibleQuotations.find((q) => q.id === quotationId)?.poNumber ?? ""} />
            </Field>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <Divider />
      <CardFooter className="flex gap-2 border-none px-0">
        <Button onClick={submit} disabled={pending || !customerId || !quotationId}>{pending ? "Creating…" : "Create draft & continue"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </CardFooter>
    </div>
  );
}
