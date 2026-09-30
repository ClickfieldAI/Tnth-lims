import Link from "next/link";
import { FileSignature, FileEdit, CheckCircle2, Send } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listDraftReports, listVerifiedResultsForSample } from "@/lib/reports/service";
import { canDraftReport } from "@/lib/reports/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NewReportForm, type RegisteredSampleOption, type VerifiedResultOption } from "./new-report-form";

export const metadata = { title: "Draft COA / Report" };

export default async function DraftReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listDraftReports(actor, { pageSize: 20 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load draft reports.";
  }

  const canCreate = canDraftReport(actor, "create");
  let samples: RegisteredSampleOption[] = [];
  const verifiedBySample: Record<string, VerifiedResultOption[]> = {};
  if (canCreate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regs = await prisma.sampleRegistration.findMany({ where: { registrationStatus: "REGISTERED" }, include: { customer: true, trf: true } }) as unknown as any[];
    samples = regs.map((r) => ({ id: r.id, sampleCode: r.sampleCode, trfCode: r.trf?.trfCode ?? "—", customerName: r.customer?.name ?? "—" }));
    for (const r of regs) {
      const available = await listVerifiedResultsForSample(actor, r.id);
      if (available.length) verifiedBySample[r.id] = available.map((a) => ({ testResultId: a.testResultId, requestedParameter: a.requestedParameter }));
    }
    samples = samples.filter((s) => verifiedBySample[s.id]?.length);
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quality" title="Draft COA / Report" description="Generate a draft Certificate of Analysis from verified test results." />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total reports" value={result!.stats.total} icon={<FileSignature className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Draft" value={result!.stats.draft} icon={<FileEdit className="h-4 w-4" />} tone="zinc" />
            <StatCard label="Generated" value={result!.stats.generated} icon={<CheckCircle2 className="h-4 w-4" />} tone="blue" />
            <StatCard label="Sent for QA" value={result!.stats.sentForQa} icon={<Send className="h-4 w-4" />} tone="violet" />
          </div>

          {canCreate ? <NewReportForm samples={samples} verifiedBySample={verifiedBySample} /> : null}

          <DataTable>
            <THead><Th>Report #</Th><Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th># Results</Th><Th>Status</Th><Th>Created</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/reports/draft/${r.id}`}>{r.reportCode}</Link>{r.revisionNumber > 1 ? <span className="ml-1 text-slate-400">Rev.{r.revisionNumber}</span> : null}</Td>
                  <Td className="text-xs">{r.sampleRegistration?.sampleCode}</Td>
                  <Td className="text-xs">{r.trf?.trfCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{r.items.length}</Td>
                  <Td><StatusBadge status={r.status} dot /></Td>
                  <Td className="text-xs">{formatDate(r.createdAt)}</Td>
                  <Td><Link href={`/reports/draft/${r.id}`} className="text-xs text-brand-600 hover:underline">Open</Link></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={8} message="No draft reports created yet." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
