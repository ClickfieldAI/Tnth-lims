import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getTrfForReceipt, getReceiptAuditHistory } from "@/lib/receipts/service";
import { ReceiptError, canReceipt } from "@/lib/receipts/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { SampleReceiptCard } from "./receipt-form";
import { ConfirmReceiptButton } from "./confirm-button";

export const metadata = { title: "Receive Samples" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function ReceiveSamplesPage({ params }: { params: Promise<{ trfId: string }> }) {
  const { trfId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let t: any;
  try {
    t = await getTrfForReceipt(actor, trfId);
  } catch (e) {
    if (e instanceof ReceiptError && e.code === "NOT_FOUND") notFound();
    if (e instanceof ReceiptError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }
  const history = await getReceiptAuditHistory(actor, trfId);

  const canRecord = canReceipt(actor, "record") && t.status === "ACCEPTED" && !t.receiptConfirmedAt;
  const canConfirm = canReceipt(actor, "confirm") && t.status === "ACCEPTED" && !t.receiptConfirmedAt;
  const canReview = canReceipt(actor, "reviewDiscrepancy");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receivedCount = (t.samples as any[]).filter((s) => s.receipt).length;
  const allReceived = receivedCount === t.samples.length;

  return (
    <div className="space-y-5">
      <Link href="/receipts" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Sample Receipt
      </Link>

      <PageHeader
        title={t.trfCode}
        description={`${t.customer?.name} · Quotation ${t.quotation?.quotationCode}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={t.receiptStatus} dot />
            {t.receiptConfirmedAt ? <Badge tone="green">Confirmed</Badge> : null}
            <Link href={`/trfs/${trfId}`} className="text-xs text-brand-600 hover:underline">View TRF</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Samples" value={t.samples.length} icon={<PackageCheck className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Received" value={`${receivedCount} / ${t.samples.length}`} tone="blue" />
        <StatCard label="Discrepancies" value={(t.samples as { receipt?: { hasDiscrepancy: boolean } | null }[]).filter((s) => s.receipt?.hasDiscrepancy).length} tone="red" />
        <StatCard label="Accepted charges" value={formatCurrency(t.acceptedChargesSnapshot, "INR")} tone="green" />
      </div>

      {t.status !== "ACCEPTED" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This TRF is in {t.status} status. Samples can only be received against an accepted TRF.
        </div>
      ) : null}

      <div className="space-y-4">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(t.samples as any[]).map((s) => (
          <SampleReceiptCard
            key={s.id}
            trfId={trfId}
            sample={{
              id: s.id, sampleName: s.sampleName, productCategory: s.productCategory, quantity: s.quantity,
              quantityUnit: s.quantityUnit, containers: s.containers, customerSampleRef: s.customerSampleRef,
              receipt: s.receipt ? {
                receivedAt: new Date(s.receipt.receivedAt).toISOString(), receivedQuantity: s.receipt.receivedQuantity,
                receivedQuantityUnit: s.receipt.receivedQuantityUnit, containerCondition: s.receipt.containerCondition,
                sealCondition: s.receipt.sealCondition, temperature: s.receipt.temperature, storageCondition: s.receipt.storageCondition,
                storageLocation: s.receipt.storageLocation, remarks: s.receipt.remarks, hasDiscrepancy: s.receipt.hasDiscrepancy,
                discrepancyTypes: s.receipt.discrepancyTypes, discrepancyRemarks: s.receipt.discrepancyRemarks,
                receivedByName: s.receipt.receivedBy ? `${s.receipt.receivedBy.firstName} ${s.receipt.receivedBy.lastName}` : undefined,
              } : null,
            }}
            canRecord={canRecord}
            canReview={canReview}
            locked={!!t.receiptConfirmedAt}
          />
        ))}
      </div>

      {canConfirm ? (
        <Card>
          <CardHeader title="Receipt Confirmation" subtitle={allReceived ? "All samples have been received — confirming locks these records." : `${t.samples.length - receivedCount} sample(s) still need to be received.`} />
          <CardContent><ConfirmReceiptButton trfId={trfId} /></CardContent>
        </Card>
      ) : null}

      {t.receiptConfirmedAt ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="text-sm text-emerald-800">
            Receipt confirmed {formatDateTime(t.receiptConfirmedAt)} by {t.receiptConfirmedBy ? `${t.receiptConfirmedBy.firstName} ${t.receiptConfirmedBy.lastName}` : "—"}. Records are now locked. Sample registration is handled separately in Module 6.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Activity & Audit History" />
        <DataTable>
          <THead><Th>When</Th><Th>Action</Th><Th>By</Th><Th>Details</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(history as any[]).map((h) => (
              <Tr key={h.id}>
                <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
                <Td><Badge tone="slate">{h.action}</Badge></Td>
                <Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td>
                <Td className="max-w-[280px] truncate font-mono text-[10px] text-slate-500"><span title={JSON.stringify(h.newValue)}>{h.newValue ? JSON.stringify(h.newValue) : "—"}</span></Td>
              </Tr>
            ))}
            {!history.length ? <TableEmpty colSpan={4} message="No receipt activity recorded yet." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );
}
