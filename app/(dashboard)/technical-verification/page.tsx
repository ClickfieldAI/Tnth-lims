import { ShieldCheck, Hourglass, CheckCircle2, RotateCcw } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listVerificationQueue } from "@/lib/verification/service";
import { canVerification } from "@/lib/verification/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Technical Verification" };

export default async function TechnicalVerificationQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listVerificationQueue(actor, { pageSize: 25 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the verification queue.";
  }

  const canVerify = canVerification(actor, "verify");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality"
        title="Technical Verification"
        description="Verify completed test results against specification before report generation."
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Completed results" value={result!.stats.total} icon={<ShieldCheck className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending" value={result!.stats.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Verified" value={result!.stats.verified} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Returned" value={result!.stats.returned} icon={<RotateCcw className="h-4 w-4" />} tone="red" />
          </div>

          <DataTable>
            <THead><Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th>Test</Th><Th>Analyst</Th><Th>Result</Th><Th>Spec</Th><Th>Status</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.testResultId} className="align-top hover:bg-slate-50">
                  <Td className="font-mono text-[11px]">{r.sampleCode ?? "—"}</Td>
                  <Td className="text-xs">{r.trfCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{r.requestedParameter}</Td>
                  <Td className="text-xs">{r.analyst ? `${r.analyst.firstName} ${r.analyst.lastName}` : "—"}</Td>
                  <Td className="text-xs">{r.resultValue} {r.unit}</Td>
                  <Td className="text-xs">{r.referenceValue || "—"}</Td>
                  <Td><StatusBadge status={r.status} dot /></Td>
                  <Td className="min-w-[220px]">{r.status === "PENDING" ? <VerifyForm testResultId={r.testResultId} canVerify={canVerify} /> : <span className="text-xs text-slate-400">{r.verification?.reviewer ? `By ${r.verification.reviewer.firstName} ${r.verification.reviewer.lastName}` : "—"}</span>}</Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={9} message="No completed results are awaiting verification." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
