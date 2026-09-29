import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getQuotation, getQuotationHistory } from "@/lib/enquiries/service";
import { EnquiryError, canQuotation, canApproveQuotation } from "@/lib/enquiries/access";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import {
  SubmitForApprovalButton, ApproveRejectButtons, SendButton, ReviseButton, AcceptanceButtons, PdfButton,
} from "./quotation-actions";

export const metadata = { title: "Quotation detail" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any;
  try {
    q = await getQuotation(actor, id);
  } catch (e) {
    if (e instanceof EnquiryError && e.code === "NOT_FOUND") notFound();
    if (e instanceof EnquiryError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }
  const history = canQuotation(actor, "history") ? await getQuotationHistory(actor, id) : [];

  const effectiveStatus = (["SENT", "APPROVED"].includes(q.status) && new Date(q.validUntil) < new Date()) ? "EXPIRED" : q.status;
  const canEdit = canQuotation(actor, "edit") && ["DRAFT", "REJECTED"].includes(q.status);
  const canApproveOrReject = q.status === "PENDING_APPROVAL" && canApproveQuotation(actor, q.preparedById);
  const canSend = canQuotation(actor, "send") && q.status === "APPROVED" && effectiveStatus !== "EXPIRED";
  const canRevise = canQuotation(actor, "revise") && ["SENT", "APPROVED", "REJECTED", "EXPIRED", "CUSTOMER_REJECTED"].includes(effectiveStatus);
  const canRecordDecision = canQuotation(actor, "recordAcceptance") && q.status === "SENT" && effectiveStatus !== "EXPIRED";

  return (
    <div className="space-y-5">
      <Link href="/quotations" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotations
      </Link>

      <PageHeader
        title={`${q.quotationCode} — Rev. ${q.revisionNumber}`}
        description={`${q.customer?.name} · Enquiry ${q.enquiry?.enquiryCode}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={effectiveStatus} dot />
            <Badge tone={q.acceptanceStatus === "ACCEPTED" ? "green" : q.acceptanceStatus === "REJECTED" ? "red" : "slate"}>{q.acceptanceStatus}</Badge>
            <PdfButton id={id} quotationCode={q.quotationCode} />
            <Link href={`/enquiries/${q.enquiryId}`} className={SECONDARY_SM_BTN}>View Enquiry</Link>
            {canEdit ? <Link href={`/quotations/${id}/edit`} className={SECONDARY_SM_BTN}>Edit Draft</Link> : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Quotation" />
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Row label="Quotation date" value={formatDate(q.quotationDate)} />
            <Row label="Valid until" value={formatDate(q.validUntil)} />
            <Row label="Prepared by" value={q.preparedBy ? `${q.preparedBy.firstName} ${q.preparedBy.lastName}` : "—"} />
            <Row label="Approved by" value={q.approvedBy ? `${q.approvedBy.firstName} ${q.approvedBy.lastName}` : "—"} />
            <Row label="Payment terms" value={q.paymentTerms} />
            <Row label="PO required" value={q.poRequired ? "Yes" : "No"} />
            <Row label="Advance required" value={q.advancePaymentRequired ? "Yes" : "No"} />
            <Row label="Sent at" value={q.sentAt ? formatDateTime(q.sentAt) : "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Commercial summary" />
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(q.subtotal, "INR")}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatCurrency(q.discountTotal, "INR")}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Taxable amount</span><span>{formatCurrency(q.taxableAmount, "INR")}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{formatCurrency(q.taxTotal, "INR")}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><span>Grand total</span><span>{formatCurrency(q.grandTotal, "INR")}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Line items" />
        <DataTable>
          <THead><Th>Product / Sample</Th><Th>Service / Test</Th><Th>Method</Th><Th>Qty</Th><Th>Unit Price</Th><Th>Discount</Th><Th>Tax</Th><Th>Total</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(q.items as any[]).map((it) => (
              <Tr key={it.id}>
                <Td className="text-xs">{it.productReference}</Td>
                <Td className="text-xs">{it.serviceName}</Td>
                <Td className="text-xs">{it.method || "—"}</Td>
                <Td className="text-xs">{it.quantity}</Td>
                <Td className="text-xs">{formatCurrency(it.unitPrice, "INR")}</Td>
                <Td className="text-xs">{formatCurrency(it.discount, "INR")}</Td>
                <Td className="text-xs">{formatCurrency(it.taxAmount, "INR")} <span className="text-slate-400">({it.taxCategory})</span></Td>
                <Td className="text-xs font-semibold">{formatCurrency(it.lineTotal, "INR")}</Td>
              </Tr>
            ))}
            {!q.items.length ? <TableEmpty colSpan={8} message="No line items yet." /> : null}
          </TBody>
        </DataTable>
      </Card>

      {(q.status === "DRAFT" || q.status === "REJECTED") && canQuotation(actor, "edit") ? (
        <Card><CardHeader title="Approval workflow" /><CardContent><SubmitForApprovalButton id={id} /></CardContent></Card>
      ) : null}
      {canApproveOrReject ? (
        <Card><CardHeader title="Approval decision" subtitle="You cannot approve a quotation you prepared yourself" /><CardContent><ApproveRejectButtons id={id} /></CardContent></Card>
      ) : null}
      {canSend ? (
        <Card><CardHeader title="Send to customer" /><CardContent><SendButton id={id} /></CardContent></Card>
      ) : null}
      {canRecordDecision ? (
        <Card><CardHeader title="Customer decision" /><CardContent><AcceptanceButtons id={id} /></CardContent></Card>
      ) : null}
      {canRevise ? (
        <Card><CardHeader title="Revision" subtitle="Creates a new draft version; this issued version is preserved" /><CardContent><ReviseButton id={id} /></CardContent></Card>
      ) : null}

      {q.rejectionReason ? (
        <Card className="border-rose-200 bg-rose-50"><CardContent className="text-sm text-rose-700"><strong>Reason:</strong> {q.rejectionReason}</CardContent></Card>
      ) : null}
      {q.acceptanceStatus === "ACCEPTED" ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="text-sm text-emerald-800">
            Accepted {formatDateTime(q.acceptanceDate)}{q.poNumber ? ` · PO ${q.poNumber}` : ""}. Manually confirmed by an authorized staff member — not a digitally authenticated customer signature.
          </CardContent>
        </Card>
      ) : null}

      {history.length ? (
        <Card>
          <CardHeader title="Revision history" />
          <DataTable>
            <THead><Th>Revision</Th><Th>Reason</Th><Th>By</Th><Th>When</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(history as any[]).map((h) => (
                <Tr key={h.id}>
                  <Td>{h.revisionNumber}</Td>
                  <Td className="text-xs">{h.revisionReason}</Td>
                  <Td className="text-xs">{h.createdBy ? `${h.createdBy.firstName} ${h.createdBy.lastName}` : "—"}</Td>
                  <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </Card>
      ) : null}
    </div>
  );
}
