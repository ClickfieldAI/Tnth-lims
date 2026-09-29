import Link from "next/link";
import { Inbox, Hourglass, PackageCheck, AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listReceiptQueue } from "@/lib/receipts/service";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ReceiptFilters } from "./receipt-filters";

export const metadata = { title: "Sample Receipt" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

export default async function ReceiptQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listReceiptQueue(actor, {
      search: sp.q, receiptStatus: sp.status !== "all" ? sp.status : undefined, priority: sp.priority !== "all" ? sp.priority : undefined,
      dateFrom: sp.from, dateTo: sp.to, page: sp.page ? Number(sp.page) : 1, pageSize: 10,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the receipt queue.";
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Sample Receipt"
        description="Record physical receipt of samples against accepted Test Request Forms."
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Accepted TRFs" value={result!.stats.total} icon={<Inbox className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending / partial" value={result!.stats.pending + result!.stats.partial} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Received" value={result!.stats.received} icon={<PackageCheck className="h-4 w-4" />} tone="green" />
            <StatCard label="With discrepancy" value={result!.stats.withDiscrepancy} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
          </div>

          <ReceiptFilters />

          <DataTable>
            <THead>
              <Th>TRF Number</Th><Th>Customer</Th><Th>Quotation</Th><Th># Samples</Th><Th>Received</Th>
              <Th>Submitted</Th><Th>Due Date</Th><Th>Priority</Th><Th>Receipt Status</Th><Th>Actions</Th>
            </THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((t) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const receivedCount = (t.samples as any[]).filter((s) => s.receipt).length;
                return (
                  <Tr key={t.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-[11px] font-semibold"><Link href={`/receipts/${t.id}`}>{t.trfCode}</Link></Td>
                    <Td className="font-medium"><Link href={`/clients/${t.customerId}`} className="text-brand-600 hover:underline">{t.customer?.name}</Link></Td>
                    <Td className="text-xs"><Link href={`/quotations/${t.quotationId}`} className="text-brand-600 hover:underline">{t.quotation?.quotationCode}</Link></Td>
                    <Td className="text-xs">{t.samples.length}</Td>
                    <Td className="text-xs">{receivedCount} / {t.samples.length}</Td>
                    <Td className="text-xs">{t.submittedAt ? formatDateTime(t.submittedAt) : "—"}</Td>
                    <Td className="text-xs">{t.requestedDueDate ? formatDate(t.requestedDueDate) : "—"}</Td>
                    <Td className="text-xs">{t.priority}</Td>
                    <Td><StatusBadge status={t.receiptStatus} dot /></Td>
                    <Td><Link href={`/receipts/${t.id}`} className={SECONDARY_SM_BTN}>Receive</Link></Td>
                  </Tr>
                );
              })}
              {!result!.rows.length ? <TableEmpty colSpan={10} message="No accepted TRFs are awaiting sample receipt." /> : null}
            </TBody>
          </DataTable>

          {result!.total > result!.pageSize ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Page {result!.page} of {totalPages} · {result!.total} TRFs</span>
              <div className="flex gap-2">
                {result!.page > 1 ? <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page - 1) } as Record<string, string>).toString()}`}>Previous</Link> : null}
                {result!.page < totalPages ? <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page + 1) } as Record<string, string>).toString()}`}>Next</Link> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
