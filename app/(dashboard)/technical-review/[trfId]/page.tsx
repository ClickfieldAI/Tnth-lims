import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, SearchCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getTrfForReview, getReviewHistory } from "@/lib/reviews/service";
import { ReviewError, canReview } from "@/lib/reviews/access";
import { findService } from "@/lib/enquiries/catalog";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { AssessmentCard } from "./assessment-card";

export const metadata = { title: "Technical Review" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function TechnicalReviewDetailPage({ params }: { params: Promise<{ trfId: string }> }) {
  const { trfId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let t: any;
  try {
    t = await getTrfForReview(actor, trfId);
  } catch (e) {
    if (e instanceof ReviewError && e.code === "NOT_FOUND") notFound();
    if (e instanceof ReviewError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }

  const canAssess = canReview(actor, "assess");
  const canDecide = canReview(actor, "decide");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviewedCount = (t.samples as any[]).filter((s) => ["ACCEPTED", "REJECTED"].includes(s.technicalReview?.status)).length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyBySample = await Promise.all((t.samples as any[]).map((s) => getReviewHistory(actor, s.id)));

  return (
    <div className="space-y-5">
      <Link href="/technical-review" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Technical Review
      </Link>

      <PageHeader
        title={t.trfCode}
        description={`${t.customer?.name} · Quotation ${t.quotation?.quotationCode}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={t.receiptStatus === "RECEIVED_WITH_DISCREPANCY" ? "red" : "green"}>{t.receiptStatus}</Badge>
            <Link href={`/trfs/${trfId}`} className="text-xs text-brand-600 hover:underline">View TRF</Link>
            <Link href={`/receipts/${trfId}`} className="text-xs text-brand-600 hover:underline">View Receipt</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Samples" value={t.samples.length} icon={<SearchCheck className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Decisions recorded" value={`${reviewedCount} / ${t.samples.length}`} tone="blue" />
        <StatCard label="With receipt discrepancy" value={(t.samples as { receipt?: { hasDiscrepancy: boolean } | null }[]).filter((s) => s.receipt?.hasDiscrepancy).length} tone="red" />
      </div>

      <div className="space-y-4">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(t.samples as any[]).map((s) => (
          <div key={s.id} className="space-y-2">
            <AssessmentCard
              trfId={trfId}
              sample={{
                id: s.id, sampleName: s.sampleName, productCategory: s.productCategory, customerSampleRef: s.customerSampleRef,
                receipt: s.receipt ? { hasDiscrepancy: s.receipt.hasDiscrepancy, discrepancyTypes: s.receipt.discrepancyTypes, discrepancyRemarks: s.receipt.discrepancyRemarks } : null,
                technicalReview: s.technicalReview ? {
                  status: s.technicalReview.status, labelingSatisfactory: s.technicalReview.labelingSatisfactory,
                  quantitySufficient: s.technicalReview.quantitySufficient, packagingSatisfactory: s.technicalReview.packagingSatisfactory,
                  sampleConditionSatisfactory: s.technicalReview.sampleConditionSatisfactory, testRequestComplete: s.technicalReview.testRequestComplete,
                  assessmentNotes: s.technicalReview.assessmentNotes, holdReason: s.technicalReview.holdReason, rejectionReason: s.technicalReview.rejectionReason,
                  clarificationComments: s.technicalReview.clarificationComments,
                  reviewedAt: s.technicalReview.reviewedAt ? new Date(s.technicalReview.reviewedAt).toISOString() : null,
                  reviewedByName: s.technicalReview.reviewedBy ? `${s.technicalReview.reviewedBy.firstName} ${s.technicalReview.reviewedBy.lastName}` : undefined,
                } : null,
              }}
              canAssess={canAssess}
              canDecide={canDecide}
            />
            <details className="rounded-lg border border-slate-200 bg-white px-4 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">Requested tests for this sample</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(s.tests as any[]).map((test) => (
                  <li key={test.id}>{test.customRequest ? test.customServiceName : findService(test.serviceId)?.division ?? test.serviceId} — {test.requestedParameter}</li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Review History" />
        <DataTable>
          <THead><Th>Sample</Th><Th>When</Th><Th>Action</Th><Th>By</Th><Th>From → To</Th><Th>Comment</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(t.samples as any[]).flatMap((s, i) => (historyBySample[i] as any[]).map((h) => (
              <Tr key={h.id}>
                <Td className="text-xs">{s.sampleName}</Td>
                <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
                <Td><Badge tone="slate">{h.action}</Badge></Td>
                <Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td>
                <Td className="text-xs">{h.fromStatus} → {h.toStatus}</Td>
                <Td className="text-xs">{h.comment || "—"}</Td>
              </Tr>
            )))}
            {historyBySample.every((h) => !h.length) ? <TableEmpty colSpan={6} message="No review activity recorded yet." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );
}
