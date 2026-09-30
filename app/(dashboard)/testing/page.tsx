import { FlaskRound, Hourglass, Loader2, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listTestingQueue } from "@/lib/result-entry/service";
import { canResultEntry } from "@/lib/result-entry/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { RowExpander } from "./row-expander";

export const metadata = { title: "Testing & Result Entry" };

export default async function TestingQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listTestingQueue(actor, { pageSize: 25 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the testing queue.";
  }

  const canEnter = canResultEntry(actor, "enter");
  const canComplete = canResultEntry(actor, "complete");
  const canCorrect = canResultEntry(actor, "correct");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Testing & Result Entry"
        description={actor.role === "ANALYST" || actor.role === "MICRO" ? "Tests assigned to you across all your active worksheets." : "All tests currently on worksheets, across analysts."}
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tests on worksheets" value={result!.stats.total} icon={<FlaskRound className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Not started" value={result!.stats.notStarted} icon={<Hourglass className="h-4 w-4" />} tone="zinc" />
            <StatCard label="In progress" value={result!.stats.inProgress} icon={<Loader2 className="h-4 w-4" />} tone="amber" />
            <StatCard label="Completed" value={result!.stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
          </div>

          <DataTable>
            <THead><Th>Sample ID</Th><Th>TRF</Th><Th>Test</Th><Th>Analyst</Th><Th>Worksheet</Th><Th>Status</Th><Th>Result</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.testAllocationId} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px]">{r.sampleCode ?? "—"}</Td>
                  <Td className="text-xs">{r.trfCode}</Td>
                  <Td className="text-xs">{r.requestedParameter}</Td>
                  <Td className="text-xs">{r.analyst ? `${r.analyst.firstName} ${r.analyst.lastName}` : "—"}</Td>
                  <Td className="text-xs">{r.worksheetCode}</Td>
                  <Td><StatusBadge status={r.status} dot /></Td>
                  <Td className="min-w-[260px]">
                    <RowExpander
                      testAllocationId={r.testAllocationId}
                      existing={r.result ? { resultValue: r.result.resultValue, unit: r.result.unit, referenceValue: r.result.referenceValue, remarks: r.result.remarks, testDate: new Date(r.result.testDate).toISOString().slice(0, 10), status: r.result.status } : null}
                      canComplete={canComplete} canCorrect={canCorrect} canEnter={canEnter}
                    />
                  </Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={7} message="No tests are currently on a worksheet." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
