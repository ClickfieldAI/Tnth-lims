import { ListTodo, Hourglass, CheckCircle2, Split } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listAllocationQueue } from "@/lib/allocation/service";
import { canAllocation } from "@/lib/allocation/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { AllocationFilters } from "./allocation-filters";
import { AllocateForm, type AnalystOption, type InstrumentOption } from "./allocate-form";

export const metadata = { title: "Test Allocation" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

export default async function TestAllocationQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listAllocationQueue(actor, {
      search: sp.q, status: sp.status !== "all" ? sp.status : undefined, priority: sp.priority !== "all" ? sp.priority : undefined,
      page: sp.page ? Number(sp.page) : 1, pageSize: 15,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load the allocation queue.";
  }

  const canManage = canAllocation(actor, "allocate");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await prisma.user.findMany({ include: { role: true } as any }) as unknown as any[];
  const analysts: AnalystOption[] = users.filter((u) => ["ANALYST", "MICRO"].includes(u.role.name) && u.isActive).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role.name }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instrumentRows = await prisma.instrument.findMany({ where: { status: { in: ["AVAILABLE", "IN_USE"] } } }) as unknown as any[];
  const instruments: InstrumentOption[] = instrumentRows.map((i) => ({ id: i.id, code: i.code, name: i.name }));

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Test Allocation"
        description="Allocate requested tests on registered samples to an analyst, instrument, priority and operational due date."
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Requested tests" value={result!.stats.totalTests} icon={<ListTodo className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Pending allocation" value={result!.stats.pendingTests} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Allocated" value={result!.stats.allocatedTests} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Samples partially allocated" value={result!.stats.partialSamples} icon={<Split className="h-4 w-4" />} tone="amber" />
            <StatCard label="Samples fully allocated" value={result!.stats.allocatedSamples} tone="green" />
          </div>

          <AllocationFilters />

          <DataTable>
            <THead>
              <Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th>Product</Th><Th>Test</Th><Th>Method</Th>
              <Th>Division</Th><Th>Analyst</Th><Th>Priority</Th><Th>Due Date</Th><Th>Status</Th><Th>Actions</Th>
            </THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((r) => (
                <Tr key={r.testRequestId} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold">{r.sampleCode}</Td>
                  <Td className="text-xs">{r.trfCode}</Td>
                  <Td className="text-xs">{r.customer?.name}</Td>
                  <Td className="text-xs">{r.productName}</Td>
                  <Td className="text-xs">{r.requestedParameter}</Td>
                  <Td className="text-xs">{r.method || "—"}</Td>
                  <Td><Badge tone="indigo">{r.serviceDivision}</Badge></Td>
                  <Td className="text-xs">{r.allocation ? `${r.allocation.analyst?.firstName} ${r.allocation.analyst?.lastName}` : "—"}</Td>
                  <Td className="text-xs">{r.allocation?.priority ?? "—"}</Td>
                  <Td className="text-xs">{r.allocation?.dueDate ? formatDate(r.allocation.dueDate) : "—"}</Td>
                  <Td><StatusBadge status={r.status} dot /></Td>
                  <Td>
                    {canManage ? (
                      <AllocateForm
                        trfTestRequestId={r.testRequestId}
                        mode={r.allocation ? "reassign" : "allocate"}
                        initial={r.allocation ? { analystId: r.allocation.analystId, instrumentId: r.allocation.instrumentId ?? undefined, priority: r.allocation.priority, dueDate: new Date(r.allocation.dueDate).toISOString().slice(0, 10) } : undefined}
                        analysts={analysts}
                        instruments={instruments}
                      />
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={12} message="No requested tests are eligible for allocation." /> : null}
            </TBody>
          </DataTable>

          {result!.total > result!.pageSize ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Page {result!.page} of {totalPages} · {result!.total} requested tests</span>
              <div className="flex gap-2">
                {result!.page > 1 ? <a className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page - 1) } as Record<string, string>).toString()}`}>Previous</a> : null}
                {result!.page < totalPages ? <a className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page + 1) } as Record<string, string>).toString()}`}>Next</a> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
