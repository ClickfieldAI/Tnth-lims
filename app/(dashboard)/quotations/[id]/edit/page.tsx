import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getQuotation } from "@/lib/enquiries/service";
import { EnquiryError, canQuotation } from "@/lib/enquiries/access";
import { PageHeader } from "@/components/ui/display";
import { QuotationDraftForm } from "./quotation-draft-form";
import type { QuotationDraftInput } from "@/lib/enquiries/validation";

export const metadata = { title: "Edit Quotation" };

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };
  if (!canQuotation(actor, "edit")) redirect(`/quotations/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any;
  try {
    q = await getQuotation(actor, id);
  } catch (e) {
    if (e instanceof EnquiryError && e.code === "NOT_FOUND") notFound();
    redirect("/quotations");
  }
  if (!["DRAFT", "REJECTED"].includes(q.status)) redirect(`/quotations/${id}`);

  const initial: QuotationDraftInput = {
    validUntil: new Date(q.validUntil).toISOString().slice(0, 10),
    paymentTerms: q.paymentTerms, advancePaymentRequired: q.advancePaymentRequired, poRequired: q.poRequired,
    billingNotes: q.billingNotes, discountTotal: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (q.items as any[]).map((it) => ({
      testRequestId: it.testRequestId ?? undefined, productReference: it.productReference, serviceName: it.serviceName,
      method: it.method, quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount,
      taxCategory: it.taxCategory, estimatedTurnaroundDays: it.estimatedTurnaroundDays,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={`/quotations/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {q.quotationCode}
      </Link>
      <PageHeader title={`Edit ${q.quotationCode} (Rev. ${q.revisionNumber})`} description={q.customer?.name} />
      <QuotationDraftForm quotationId={id} initial={initial} />
    </div>
  );
}
