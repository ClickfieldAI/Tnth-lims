import { FileEdit, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listCorrections } from "@/lib/corrections/service";
import { canCorrection } from "@/lib/corrections/access";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { CorrectionActions, NewCorrectionForm } from "./corrections-actions";

export const metadata = { title: "Corrections & Amendments" };

export default async function CorrectionsQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listCorrections(actor, { pageSize: 25 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load corrections.";
  }

  const canRequest = canCorrection(actor, "request");
  const canDecide = canCorrection(actor, "decide");
  const canComplete = canCorrection(actor, "complete");

  // Eligible source reports for a new correction request: anything past the
  // plain-draft stage (verified/QA'd/released), where a direct edit is no
  // longer appropriate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eligibleReports: any[] = [];
  if (canRequest) {
    eligibleReports = await prisma.draftReport.findMany({ include: { sampleRegistration: true, customer: true } });
    eligibleReports = eligibleReports.filter((r) => r.status !== "DRAFT");
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quality" title="Corrections & Amendments" description="Controlled correction of reports or results after verification, QA review or release." />

      {canRequest ? <NewCorrectionForm reports={eligibleReports} /> : null}

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total requests" value={result!.stats.total} icon={<FileEdit className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Requested / in review" value={result!.stats.requested + result!.stats.underReview} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Completed" value={result!.stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Rejected" value={result!.stats.rejected} icon={<XCircle className="h-4 w-4" />} tone="red" />
          </div>

          <DataTable>
            <THead><Th>Correction #</Th><Th>Report #</Th><Th>Sample ID</Th><Th>Customer</Th><Th>Original</Th><Th>Corrected</Th><Th>Requested By</Th><Th>Reviewed By</Th><Th>Status</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.id} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold">{r.correctionCode}</Td>
                  <Td className="text-xs">{r.draftReport?.reportCode}</Td>
                  <Td className="text-xs">{r.sampleRegistration?.sampleCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="max-w-[140px] truncate text-xs"><span title={r.originalValue}>{r.originalValue}</span></Td>
                  <Td className="max-w-[140px] truncate text-xs"><span title={r.correctedValue}>{r.correctedValue}</span></Td>
                  <Td className="text-xs">{r.requestedBy ? `${r.requestedBy.firstName} ${r.requestedBy.lastName}` : "—"}</Td>
                  <Td className="text-xs">{r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : "—"}</Td>
                  <Td><StatusBadge status={r.status} dot /></Td>
                  <Td className="min-w-[200px]">
                    <CorrectionActions id={r.id} status={r.status} canDecide={canDecide} canComplete={canComplete} />
                  </Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={10} message="No correction requests have been raised." /> : null}
            </TBody>
          </DataTable>
          <p className="text-[11px] text-slate-400">Requested at times are recorded internally; full correction history is available via the audit trail and is not shown to clients — clients only ever see the corrected, released revision once it completes the normal release workflow. Last updated {formatDateTime(new Date())}.</p>
        </>
      )}
    </div>
  );
}
