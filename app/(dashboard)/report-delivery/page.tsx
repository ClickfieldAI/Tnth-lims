import { Truck, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listDeliveryQueue } from "@/lib/delivery/service";
import { canDelivery } from "@/lib/delivery/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { DeliveryForm, MarkFailedButton } from "./delivery-form";

export const metadata = { title: "Report Delivery" };

export default async function ReportDeliveryQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listDeliveryQueue(actor, { pageSize: 20 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the delivery queue.";
  }

  const canManage = canDelivery(actor, "manage");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Report Delivery"
        description={actor.role === "CLIENT" ? "Your organization's released test reports." : "Deliver released reports to customers via email, portal, or manual handoff."}
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Released reports" value={result!.stats.total} icon={<Truck className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending delivery" value={result!.stats.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Delivered" value={result!.stats.delivered} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Failed" value={result!.stats.failed} icon={<XCircle className="h-4 w-4" />} tone="red" />
          </div>

          <DataTable>
            <THead><Th>Report #</Th><Th>Sample ID</Th><Th>Customer</Th><Th>Release Date</Th><Th>Method</Th><Th>Status</Th><Th>Delivered</Th><Th>Recipient</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.id} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold">{r.reportCode}</Td>
                  <Td className="text-xs">{r.sampleRegistration?.sampleCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{formatDate(r.release?.releasedAt)}</Td>
                  <Td className="text-xs">{r.latestDelivery?.deliveryMethod ?? "—"}</Td>
                  <Td><StatusBadge status={r.latestDelivery?.status ?? "PENDING"} dot /></Td>
                  <Td className="text-xs">{r.latestDelivery?.deliveredAt ? formatDateTime(r.latestDelivery.deliveredAt) : "—"}</Td>
                  <Td className="text-xs">{r.latestDelivery?.recipient ?? "—"}</Td>
                  <Td className="min-w-[180px] space-y-1">
                    <DeliveryForm draftReportId={r.id} latestStatus={r.latestDelivery?.status ?? null} canManage={canManage} />
                    {canManage && r.latestDelivery?.status === "DELIVERED" ? <MarkFailedButton deliveryId={r.latestDelivery.id} /> : null}
                  </Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={9} message="No released reports available for delivery." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
