import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getEnquiry } from "@/lib/enquiries/service";
import { EnquiryError, canEnquiry } from "@/lib/enquiries/access";
import { findService } from "@/lib/enquiries/catalog";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { RowActions } from "../enquiry-actions";

export const metadata = { title: "Enquiry detail" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let e: any;
  try {
    e = await getEnquiry(actor, id);
  } catch (err) {
    if (err instanceof EnquiryError && err.code === "NOT_FOUND") notFound();
    if (err instanceof EnquiryError && err.code === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }

  const canEdit = canEnquiry(actor, "edit") && !["ACCEPTED", "REJECTED", "CLOSED"].includes(e.status);
  const closed = ["CLOSED", "ACCEPTED", "REJECTED"].includes(e.status);
  const latestQuotation = e.quotations.length ? e.quotations[e.quotations.length - 1] : null;

  return (
    <div className="space-y-5">
      <Link href="/enquiries" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Enquiries
      </Link>

      <PageHeader
        title={e.enquiryCode}
        description={`${e.customer?.name} · ${e.priority} priority · Assigned to ${e.assignedManager ? `${e.assignedManager.firstName} ${e.assignedManager.lastName}` : "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={e.status} dot />
            <RowActions id={id} canEdit={canEdit} canClose={canEnquiry(actor, "close")} closed={closed} quotationId={latestQuotation?.id} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Customer" action={<Link href={`/clients/${e.customerId}`} className={SECONDARY_SM_BTN}>Open Customer</Link>} />
          <CardContent className="grid grid-cols-2 gap-4">
            <Row label="Customer ID" value={e.customer?.code} />
            <Row label="Company" value={e.customer?.name} />
            <Row label="Primary contact" value={e.customer?.contactPerson} />
            <Row label="Email" value={e.customer?.email} />
            <Row label="Phone" value={e.customer?.phone} />
            <Row label="Enquiry source" value={e.enquirySource} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Requirements" />
          <CardContent className="space-y-3">
            <Row label="Requested turnaround" value={`${e.requestedTurnaroundDays} days`} />
            <Row label="Purpose of testing" value={e.purposeOfTesting} />
            <Row label="Regulatory requirements" value={e.regulatoryRequirements} />
            <Row label="Reporting format" value={e.requiredReportingFormat} />
          </CardContent>
        </Card>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(e.products as any[]).map((p, pi) => (
        <Card key={p.id}>
          <CardHeader title={`Product ${pi + 1}: ${p.productName}`} subtitle={`${p.productCategory} · ${p.sampleType || "—"}`} />
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Row label="Batch no." value={p.batchNumber} />
            <Row label="Quantity" value={p.quantity ? `${p.quantity} ${p.quantityUnit || ""}` : "—"} />
            <Row label="Storage" value={p.storageRequirements} />
            <Row label="Requested testing date" value={p.requestedTestingDate ? formatDate(p.requestedTestingDate) : "—"} />
          </CardContent>
          <DataTable>
            <THead><Th>Service</Th><Th>Requested Test</Th><Th>Method</Th><Th>Qty</Th><Th>TAT</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(p.tests as any[]).map((t) => (
                <Tr key={t.id}>
                  <Td>{t.customRequest ? <Badge tone="amber">{t.customServiceName} (custom — pending review)</Badge> : <Badge tone="indigo">{findService(t.serviceId)?.division ?? t.serviceId}</Badge>}</Td>
                  <Td className="text-xs">{t.requestedTest}</Td>
                  <Td className="text-xs">{t.requestedMethod || "—"}</Td>
                  <Td className="text-xs">{t.requestedQuantity}</Td>
                  <Td className="text-xs">{t.estimatedTurnaroundDays ? `${t.estimatedTurnaroundDays}d` : "—"}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </Card>
      ))}

      <Card>
        <CardHeader title="Quotations" subtitle="All quotation versions prepared for this enquiry" />
        <DataTable>
          <THead><Th>Quotation</Th><Th>Rev.</Th><Th>Status</Th><Th>Grand Total</Th><Th>Valid Until</Th><Th></Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(e.quotations as any[]).map((q) => (
              <Tr key={q.id}>
                <Td className="font-mono text-[11px]">{q.quotationCode}</Td>
                <Td className="text-xs">{q.revisionNumber}</Td>
                <Td><StatusBadge status={q.status} dot /></Td>
                <Td className="text-xs">{formatCurrency(q.grandTotal, "INR")}</Td>
                <Td className="text-xs">{formatDate(q.validUntil)}</Td>
                <Td><Link href={`/quotations/${q.id}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><FileText className="h-3.5 w-3.5" /> View</Link></Td>
              </Tr>
            ))}
            {!e.quotations.length ? <TableEmpty colSpan={6} message="No quotations prepared yet." /> : null}
          </TBody>
        </DataTable>
      </Card>

      {e.status === "ACCEPTED" ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="text-sm text-emerald-800">
            This enquiry's quotation has been accepted by the customer. It is ready for Test Request Form (TRF) processing in Module 3.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Activity" subtitle={`Created ${formatDateTime(e.createdAt)}`} />
        <CardContent className="text-xs text-slate-500">Last updated {formatDateTime(e.updatedAt)}</CardContent>
      </Card>
    </div>
  );
}
