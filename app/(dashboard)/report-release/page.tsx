import Link from "next/link";
import { Stamp, Hourglass, CheckCircle2, RotateCcw } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listReleaseQueue } from "@/lib/release/service";
import { canRelease } from "@/lib/release/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ReleaseForm } from "./release-form";

export const metadata = { title: "Report Release" };

export default async function ReportReleaseQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listReleaseQueue(actor, { pageSize: 20 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the release queue.";
  }

  const canDecide = canRelease(actor, "release");

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quality" title="Authorized Approval & Release" description="Final authorization step before a QA-approved report is released to the customer." />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="QA-approved reports" value={result!.stats.total} icon={<Stamp className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Awaiting authorization" value={result!.stats.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Released" value={result!.stats.released} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Returned" value={result!.stats.returned} icon={<RotateCcw className="h-4 w-4" />} tone="red" />
          </div>

          <DataTable>
            <THead><Th>Report #</Th><Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th>QA Approved</Th><Th>Release Status</Th><Th>Authorized By</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.id} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/reports/draft/${r.id}`}>{r.reportCode}</Link></Td>
                  <Td className="text-xs">{r.sampleRegistration?.sampleCode}</Td>
                  <Td className="text-xs">{r.trf?.trfCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{r.qaReview?.reviewedAt ? formatDate(r.qaReview.reviewedAt) : "—"}</Td>
                  <Td><StatusBadge status={r.release?.status ?? "PENDING"} dot /></Td>
                  <Td className="text-xs">{r.release?.releasedBy ? `${r.release.releasedBy.firstName} ${r.release.releasedBy.lastName}` : "—"}</Td>
                  <Td className="min-w-[220px]">{(r.release?.status ?? "PENDING") === "PENDING" ? <ReleaseForm draftReportId={r.id} canRelease={canDecide} /> : <Link href={`/reports/draft/${r.id}`} className="text-xs text-brand-600 hover:underline">View</Link>}</Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={8} message="No QA-approved reports are awaiting release." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
