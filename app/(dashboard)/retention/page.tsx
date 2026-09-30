import { Archive, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listRetentionQueue } from "@/lib/retention/service";
import { canRetention } from "@/lib/retention/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RetentionActions } from "./retention-actions";

export const metadata = { title: "Retention & Disposal" };

export default async function RetentionQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listRetentionQueue(actor, { pageSize: 25 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load retention records.";
  }

  const canExtend = canRetention(actor, "extend");
  const canDispose = canRetention(actor, "dispose");

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quality" title="Retention & Disposal" description="Track retained samples and their disposal after release." />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total retained" value={result!.stats.total} icon={<Archive className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Retained / extended" value={result!.stats.retained + result!.stats.extended} icon={<Clock className="h-4 w-4" />} tone="blue" />
            <StatCard label="Due for disposal" value={result!.stats.dueForDisposal} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
            <StatCard label="Disposed" value={result!.stats.disposed} icon={<Trash2 className="h-4 w-4" />} tone="zinc" />
          </div>

          <DataTable>
            <THead><Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th>Product</Th><Th>Storage Location</Th><Th>Start</Th><Th>Expiry</Th><Th>Status</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.id} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold">{r.sampleRegistration?.sampleCode}</Td>
                  <Td className="text-xs">{r.trf?.trfCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{r.sampleRegistration?.trfSample?.sampleName}</Td>
                  <Td className="text-xs">{r.storageLocation || "—"}</Td>
                  <Td className="text-xs">{formatDate(r.retentionStartDate)}</Td>
                  <Td className="text-xs">{formatDate(r.retentionExpiryDate)}</Td>
                  <Td><StatusBadge status={r.effectiveStatus} dot /></Td>
                  <Td className="min-w-[180px]"><RetentionActions id={r.id} canExtend={canExtend} canDispose={canDispose} disposed={r.effectiveStatus === "DISPOSED"} /></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={9} message="No samples are currently in retention." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
