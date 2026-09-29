import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canTrf } from "@/lib/trfs/access";
import { getEligibleQuotations } from "@/lib/trfs/service";
import { PageHeader } from "@/components/ui/display";
import { NewTrfForm, type CustomerOption, type EligibleQuotation } from "./new-trf-form";

export const metadata = { title: "Create TRF" };

export default async function NewTrfPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };
  if (!canTrf(actor, "create")) redirect("/trfs");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCustomers = await prisma.client.findMany({}) as unknown as any[];
  const customers = user.role === "CLIENT" ? allCustomers.filter((c) => c.id === user.clientId) : allCustomers;
  const customerOptions: CustomerOption[] = customers.map((c) => ({
    id: c.id, code: c.code, name: c.name, contactPerson: c.contactPerson ?? "", email: c.email ?? "", phone: c.phone ?? "",
    isActive: c.isActive, billing: c.billing, reporting: c.reporting, reportingSameAsBilling: c.reportingSameAsBilling,
  }));

  const quotationsByCustomer: Record<string, EligibleQuotation[]> = {};
  for (const c of customerOptions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligible = await getEligibleQuotations(c.id) as any[];
    quotationsByCustomer[c.id] = eligible.map((q) => ({ id: q.id, quotationCode: q.quotationCode, revisionNumber: q.revisionNumber, grandTotal: q.grandTotal, paymentTerms: q.paymentTerms, poNumber: q.poNumber, customerId: q.customerId }));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/trfs" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Test Request Forms
      </Link>
      <PageHeader title="Create Test Request Form" description="Step 1 of 6 — link this TRF to a customer and their accepted quotation. The remaining steps are completed after the draft is created." />
      <NewTrfForm customers={customerOptions} quotationsByCustomer={quotationsByCustomer} />
    </div>
  );
}
