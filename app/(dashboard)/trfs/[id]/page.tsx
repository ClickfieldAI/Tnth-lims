import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getTrf, getTrfHistory } from "@/lib/trfs/service";
import { TrfError, canTrf } from "@/lib/trfs/access";
import { findService } from "@/lib/enquiries/catalog";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { Tabs } from "../../clients/[id]/tabs";
import { TrfReviewActions } from "./trf-review-actions";

export const metadata = { title: "TRF detail" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function TrfDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let t: any;
  try {
    t = await getTrf(actor, id);
  } catch (e) {
    if (e instanceof TrfError && e.code === "NOT_FOUND") notFound();
    if (e instanceof TrfError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }
  const history = canTrf(actor, "history") ? await getTrfHistory(actor, id) : [];
  const totalTests = (t.samples as { tests: unknown[] }[]).reduce((a: number, s) => a + s.tests.length, 0);

  const overviewTab = (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Customer & commercial" action={<Link href={`/clients/${t.customerId}`} className={SECONDARY_SM_BTN}>Open Customer</Link>} />
        <CardContent className="grid grid-cols-2 gap-4">
          <Row label="Customer ID" value={t.customer?.code} />
          <Row label="Company" value={t.customer?.name} />
          <Row label="Quotation" value={<Link href={`/quotations/${t.quotationId}`} className="text-brand-600 hover:underline">{t.quotation?.quotationCode} (Rev.{t.quotationRevisionSnapshot})</Link>} />
          <Row label="PO number" value={t.poNumber} />
          <Row label="Accepted charges (snapshot)" value={formatCurrency(t.acceptedChargesSnapshot, "INR")} />
          <Row label="Payment terms (snapshot)" value={t.paymentTermsSnapshot} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Timing & priority" />
        <CardContent className="space-y-3">
          <Row label="Submission date" value={t.submittedAt ? formatDateTime(t.submittedAt) : "Not yet submitted"} />
          <Row label="Requested due date" value={t.requestedDueDate ? formatDate(t.requestedDueDate) : "—"} />
          <Row label="Priority" value={t.priority} />
          <Row label="Created by" value={t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "—"} />
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader title="Testing summary" />
        <CardContent className="flex gap-6 text-sm">
          <span>{t.samples.length} sample(s)</span>
          <span>{totalTests} requested test(s)</span>
        </CardContent>
      </Card>
    </div>
  );

  const samplesTab = (
    <div className="space-y-3">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(t.samples as any[]).map((s, i) => (
        <Card key={s.id}>
          <CardHeader title={`Sample ${i + 1}: ${s.sampleName}`} subtitle={`${s.productCategory} · Ref ${s.customerSampleRef || "—"}`} />
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Row label="Batch / lot" value={s.batchNumber} />
            <Row label="Quantity" value={`${s.quantity} ${s.quantityUnit} · ${s.containers} container(s)`} />
            <Row label="Manufacturer" value={s.manufacturer} />
            <Row label="Expiry" value={s.expiryDate ? formatDate(s.expiryDate) : "—"} />
            <Row label="Sampled by" value={s.sampledBy} />
            <Row label="Sampling date" value={s.samplingDate ? formatDate(s.samplingDate) : "—"} />
            <Row label="Sampling location" value={s.samplingLocation} />
            <Row label="Packaging" value={s.packagingType} />
          </CardContent>
        </Card>
      ))}
      {!t.samples.length ? <p className="text-sm text-slate-400">No samples added yet.</p> : null}
    </div>
  );

  const testingTab = (
    <div className="space-y-3">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(t.samples as any[]).map((s) => (
        <Card key={s.id}>
          <CardHeader title={s.sampleName} />
          <DataTable>
            <THead><Th>Service</Th><Th>Parameter</Th><Th>Method</Th><Th>Specification</Th><Th>Required Qty</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(s.tests as any[]).map((test) => (
                <Tr key={test.id}>
                  <Td>{test.customRequest ? <Badge tone="amber">{test.customServiceName} (flagged for technical review)</Badge> : <Badge tone="indigo">{findService(test.serviceId)?.division ?? test.serviceId}</Badge>}</Td>
                  <Td className="text-xs">{test.requestedParameter}</Td>
                  <Td className="text-xs">{test.preferredMethod || "—"}</Td>
                  <Td className="text-xs">{test.specification || "—"}</Td>
                  <Td className="text-xs">{test.requiredQuantity || "—"}</Td>
                </Tr>
              ))}
              {!s.tests.length ? <TableEmpty colSpan={5} message="No tests requested." /> : null}
            </TBody>
          </DataTable>
        </Card>
      ))}
    </div>
  );

  const documentsTab = (
    <DataTable>
      <THead><Th>Type</Th><Th>File</Th><Th>Size</Th><Th>Uploaded</Th></THead>
      <TBody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(t.documents as any[]).map((d) => (
          <Tr key={d.id}>
            <Td><Badge tone="indigo">{d.docType}</Badge></Td>
            <Td className="font-mono text-xs">{d.fileName}</Td>
            <Td className="text-xs">{(d.sizeBytes / 1024).toFixed(0)} KB</Td>
            <Td className="text-xs">{formatDateTime(d.uploadedAt)}</Td>
          </Tr>
        ))}
        {!t.documents.length ? <TableEmpty colSpan={4} message="No documents uploaded." /> : null}
      </TBody>
    </DataTable>
  );

  const authorizationTab = (
    <Card>
      <CardHeader title="Customer Authorization" />
      <CardContent className="grid grid-cols-2 gap-4">
        <Row label="Status" value={<Badge tone={t.authorization?.status === "AUTHORIZED" ? "green" : "amber"}>{t.authorization?.status ?? "NOT_AUTHORIZED"}</Badge>} />
        <Row label="Authorized person" value={t.authorization?.authorizedPersonName} />
        <Row label="Designation" value={t.authorization?.authorizedPersonDesignation} />
        <Row label="Authorization date" value={t.authorization?.authorizationDate ? formatDate(t.authorization.authorizationDate) : "—"} />
        <Row label="Authorization method" value={t.authorization?.authorizationMethod} />
        <Row label="Notes" value={t.authorization?.notes} />
      </CardContent>
      <CardContent className="text-[11px] text-amber-700 border-t border-[var(--border-soft)]">
        This reflects staff-confirmed authorization evidence, not a digitally authenticated electronic signature.
      </CardContent>
    </Card>
  );

  const reviewTab = (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Current status" />
        <CardContent className="space-y-3">
          <Row label="Status" value={<StatusBadge status={t.status} dot />} />
          {t.holdReason ? <Row label="Hold reason" value={t.holdReason} /> : null}
          {t.rejectionReason ? <Row label="Rejection reason" value={t.rejectionReason} /> : null}
          {t.clarificationComments ? <Row label="Clarification requested" value={t.clarificationComments} /> : null}
        </CardContent>
        {canTrf(actor, "review") ? <CardContent className="border-t border-[var(--border-soft)]"><TrfReviewActions id={id} status={t.status} /></CardContent> : null}
      </Card>
      {t.status === "ACCEPTED" ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="text-sm text-emerald-800">This TRF has been accepted and is ready for the Sample Receipt module.</CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Review history" />
        <DataTable>
          <THead><Th>When</Th><Th>Action</Th><Th>By</Th><Th>From → To</Th><Th>Comment</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(history as any[]).map((h) => (
              <Tr key={h.id}>
                <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
                <Td><Badge tone="slate">{h.action}</Badge></Td>
                <Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td>
                <Td className="text-xs">{h.fromStatus} → {h.toStatus}</Td>
                <Td className="text-xs">{h.comment || "—"}</Td>
              </Tr>
            ))}
            {!canTrf(actor, "history") ? <TableEmpty colSpan={5} message="You do not have permission to view review history." /> : null}
            {canTrf(actor, "history") && !history.length ? <TableEmpty colSpan={5} message="No review activity yet." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );

  const tabs = [
    { key: "overview", label: "Overview", content: overviewTab },
    { key: "samples", label: "Samples", content: samplesTab },
    { key: "testing", label: "Testing Requirements", content: testingTab },
    { key: "documents", label: "Documents", content: documentsTab },
    { key: "authorization", label: "Authorization", content: authorizationTab },
    { key: "review", label: "Review & Decisions", content: reviewTab },
  ];

  return (
    <div className="space-y-5">
      <Link href="/trfs" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Test Request Forms
      </Link>

      <PageHeader
        title={t.trfCode ?? `Draft TRF (${t.id})`}
        description={`${t.customer?.name} · ${t.samples.length} sample(s)`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={t.status} dot />
            {t.status === "DRAFT" && canTrf(actor, "edit") ? <Link href={`/trfs/${id}/edit`} className={SECONDARY_SM_BTN}>Continue editing</Link> : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Samples" value={t.samples.length} icon={<FlaskConical className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Requested tests" value={totalTests} tone="blue" />
        <StatCard label="Documents" value={t.documents.length} tone="violet" />
        <StatCard label="Accepted charges" value={formatCurrency(t.acceptedChargesSnapshot, "INR")} tone="green" />
      </div>

      <Card><CardContent><Tabs tabs={tabs} /></CardContent></Card>
    </div>
  );
}
