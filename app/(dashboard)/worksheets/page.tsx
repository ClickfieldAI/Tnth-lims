import Link from "next/link";
import { ListChecks, FileEdit, CheckCircle2, Send } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listWorksheets, listAvailableAllocations } from "@/lib/worksheets/service";
import { canWorksheet } from "@/lib/worksheets/access";
import { findService } from "@/lib/enquiries/catalog";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NewWorksheetForm, type AvailableAllocation } from "./new-worksheet-form";

export const metadata = { title: "Worksheets" };

export default async function WorksheetsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listWorksheets(actor, { pageSize: 20 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load worksheets.";
  }

  const canCreate = canWorksheet(actor, "create");
  let available: AvailableAllocation[] = [];
  if (canCreate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allocations = await listAvailableAllocations(actor) as any[];
    available = allocations.map((a) => ({
      id: a.id, sampleCode: a.trfTestRequest.sample.registration?.sampleCode ?? "Not registered",
      trfCode: a.trfTestRequest.sample.trf?.trfCode ?? "—", customerName: a.trfTestRequest.sample.trf?.customer?.name ?? "—",
      requestedParameter: a.trfTestRequest.customRequest ? a.trfTestRequest.customServiceName : (findService(a.trfTestRequest.serviceId)?.division ?? a.trfTestRequest.requestedParameter) + " — " + a.trfTestRequest.requestedParameter,
      analystName: a.analyst ? `${a.analyst.firstName} ${a.analyst.lastName}` : "—", analystId: a.analystId,
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Operations" title="Worksheets" description="Convert allocated tests into worksheets for analysts to perform testing." />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total worksheets" value={result!.stats.total} icon={<ListChecks className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Draft" value={result!.stats.draft} icon={<FileEdit className="h-4 w-4" />} tone="zinc" />
            <StatCard label="Prepared" value={result!.stats.prepared} icon={<CheckCircle2 className="h-4 w-4" />} tone="blue" />
            <StatCard label="Assigned / In progress" value={result!.stats.assigned + result!.stats.inProgress} icon={<Send className="h-4 w-4" />} tone="amber" />
          </div>

          {canCreate ? <NewWorksheetForm available={available} /> : null}

          <DataTable>
            <THead><Th>Worksheet #</Th><Th># Tests</Th><Th>Analyst</Th><Th>Instrument</Th><Th>Due Date</Th><Th>Status</Th><Th>Created</Th><Th>Actions</Th></THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((w) => (
                <Tr key={w.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/worksheets/${w.id}`}>{w.worksheetCode}</Link></Td>
                  <Td className="text-xs">{w.items.length}</Td>
                  <Td className="text-xs">{w.analyst ? `${w.analyst.firstName} ${w.analyst.lastName}` : "—"}</Td>
                  <Td className="text-xs">{w.instrument ? `${w.instrument.code}` : "—"}</Td>
                  <Td className="text-xs">{w.dueDate ? formatDate(w.dueDate) : "—"}</Td>
                  <Td><StatusBadge status={w.status} dot /></Td>
                  <Td className="text-xs">{formatDate(w.createdAt)}</Td>
                  <Td><Link href={`/worksheets/${w.id}`} className="text-xs text-brand-600 hover:underline">Open</Link></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={8} message="No worksheets created yet." /> : null}
            </TBody>
          </DataTable>
        </>
      )}
    </div>
  );
}
