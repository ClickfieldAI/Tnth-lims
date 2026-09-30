import Link from "next/link";
import { Tag, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listRegistrationQueue } from "@/lib/registration/service";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { RegistrationFilters } from "./registration-filters";

export const metadata = { title: "Sample Registration" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

export default async function SampleRegistrationQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listRegistrationQueue(actor, {
      search: sp.q, registrationStatus: sp.status !== "all" ? sp.status : undefined, priority: sp.priority !== "all" ? sp.priority : undefined,
      dateFrom: sp.from, dateTo: sp.to, page: sp.page ? Number(sp.page) : 1, pageSize: 15,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the registration queue.";
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Sample Registration"
        description="Register technically accepted samples with a unique laboratory Sample ID and barcode."
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Eligible samples" value={result!.stats.total} icon={<Tag className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending registration" value={result!.stats.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Registered" value={result!.stats.registered} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Cancelled" value={result!.stats.cancelled} icon={<XCircle className="h-4 w-4" />} tone="red" />
          </div>

          <RegistrationFilters />

          <DataTable>
            <THead>
              <Th>Sample ID</Th><Th>TRF Number</Th><Th>Customer</Th><Th>Product / Sample</Th><Th>Batch / Lot</Th>
              <Th>Receipt Date</Th><Th>Review Status</Th><Th>Registration Status</Th><Th>Priority</Th><Th>Actions</Th>
            </THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.sample.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold">{r.sample.registration?.sampleCode ?? "—"}</Td>
                  <Td className="text-xs"><Link href={`/trfs/${r.trfId}`} className="text-brand-600 hover:underline">{r.trfCode}</Link></Td>
                  <Td className="font-medium"><Link href={`/clients/${r.customer?.id}`} className="text-brand-600 hover:underline">{r.customer?.name}</Link></Td>
                  <Td className="text-xs">{r.sample.sampleName}</Td>
                  <Td className="text-xs">{r.sample.batchNumber || "—"}</Td>
                  <Td className="text-xs">{r.receivedAt ? formatDateTime(r.receivedAt) : "—"}</Td>
                  <Td className="text-xs">{r.sample.technicalReview?.status ?? "—"}</Td>
                  <Td><StatusBadge status={r.registrationStatus} dot /></Td>
                  <Td className="text-xs">{r.priority}</Td>
                  <Td><Link href={`/sample-registration/${r.sample.id}`} className={SECONDARY_SM_BTN}>{r.registrationStatus === "PENDING_REGISTRATION" ? "Register" : "View"}</Link></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={10} message="No technically accepted samples are awaiting registration." /> : null}
            </TBody>
          </DataTable>

          {result!.total > result!.pageSize ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Page {result!.page} of {totalPages} · {result!.total} samples</span>
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
