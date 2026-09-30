import Link from "next/link";
import { BadgeCheck, Hourglass, CheckCircle2, RotateCcw } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listQaReviewQueue } from "@/lib/qa-review/service";
import { canQaReview } from "@/lib/qa-review/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { QaDecisionForm } from "./decision-form";

export const metadata = { title: "QA Review" };

export default async function QaReviewQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listQaReviewQueue(actor, { pageSize: 20 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the QA review queue.";
  }

  const canDecide = canQaReview(actor, "decide");

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quality" title="QA Review" description="Review draft reports sent for QA before final authorization." />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sent for QA" value={result!.stats.total} icon={<BadgeCheck className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending" value={result!.stats.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Approved" value={result!.stats.approved} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Returned" value={result!.stats.returned} icon={<RotateCcw className="h-4 w-4" />} tone="red" />
          </div>

          <DataTable>
            <THead><Th>Report #</Th><Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th># Results</Th><Th>QA Status</Th><Th>Created</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.id} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/reports/draft/${r.id}`}>{r.reportCode}</Link></Td>
                  <Td className="text-xs">{r.sampleRegistration?.sampleCode}</Td>
                  <Td className="text-xs">{r.trf?.trfCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{r.items.length}</Td>
                  <Td><StatusBadge status={r.qaReview?.status ?? "PENDING"} dot /></Td>
                  <Td className="text-xs">{formatDate(r.createdAt)}</Td>
                  <Td className="min-w-[200px]">{r.qaReview?.status === "PENDING" ? <QaDecisionForm draftReportId={r.id} canDecide={canDecide} /> : <Link href={`/reports/draft/${r.id}`} className="text-xs text-brand-600 hover:underline">View</Link>}</Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={8} message="No reports are currently awaiting QA review." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
