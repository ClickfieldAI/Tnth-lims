import Link from "next/link";
import { SearchCheck, Hourglass, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listReviewQueue } from "@/lib/reviews/service";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ReviewFilters } from "./review-filters";

export const metadata = { title: "Technical Review" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

export default async function TechnicalReviewQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listReviewQueue(actor, {
      search: sp.q, reviewStatus: sp.status !== "all" ? sp.status : undefined, receiptStatus: sp.receipt !== "all" ? sp.receipt : undefined,
      page: sp.page ? Number(sp.page) : 1, pageSize: 15,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the review queue.";
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Technical Review"
        description="Assess samples with confirmed receipt for suitability, labeling, quantity and test-request completeness."
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Samples ready for review" value={result!.stats.total} icon={<SearchCheck className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending" value={result!.stats.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Accepted" value={result!.stats.accepted} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="On hold" value={result!.stats.onHold} icon={<PauseCircle className="h-4 w-4" />} tone="amber" />
            <StatCard label="Rejected" value={result!.stats.rejected} icon={<XCircle className="h-4 w-4" />} tone="red" />
          </div>

          <ReviewFilters />

          <DataTable>
            <THead>
              <Th>TRF Number</Th><Th>Customer</Th><Th>Sample</Th><Th>Receipt Status</Th><Th>Review Status</Th><Th>Actions</Th>
            </THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.sample.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/technical-review/${r.trfId}`}>{r.trfCode}</Link></Td>
                  <Td className="font-medium"><Link href={`/clients/${r.customer?.id}`} className="text-brand-600 hover:underline">{r.customer?.name}</Link></Td>
                  <Td className="text-xs">{r.sample.sampleName}</Td>
                  <Td><Badge tone={r.receiptStatus === "RECEIVED_WITH_DISCREPANCY" ? "red" : "green"}>{r.receiptStatus}</Badge></Td>
                  <Td><StatusBadge status={r.reviewStatus} dot /></Td>
                  <Td><Link href={`/technical-review/${r.trfId}`} className={SECONDARY_SM_BTN}>Review</Link></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={6} message="No samples with confirmed receipt are awaiting technical review." /> : null}
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
