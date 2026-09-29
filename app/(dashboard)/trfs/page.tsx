import Link from "next/link";
import { ClipboardList, FileEdit, Send, Hourglass, CheckCircle2, PauseCircle, XCircle, Plus, ArrowUpDown } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listTrfs } from "@/lib/trfs/service";
import { canTrf } from "@/lib/trfs/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { TrfFilters } from "./trf-filters";

export const metadata = { title: "Test Request Forms" };

const PRIMARY_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-10 px-4 text-sm bg-brand-700 text-white shadow-[var(--shadow-xs)] hover:bg-brand-800 active:bg-brand-900";
const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

function sortLink(current: Search, key: string) {
  const dir = current.sortBy === key && current.sortDir !== "desc" ? "desc" : "asc";
  const params = new URLSearchParams(current as Record<string, string>);
  params.set("sortBy", key); params.set("sortDir", dir);
  return `?${params.toString()}`;
}

export default async function TrfsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listTrfs(actor, {
      search: sp.q, status: sp.status !== "all" ? sp.status : undefined, priority: sp.priority !== "all" ? sp.priority : undefined,
      dateFrom: sp.from, dateTo: sp.to,
      sortBy: (sp.sortBy as "trfCode" | "createdAt" | "requestedDueDate" | "status") ?? "createdAt",
      sortDir: (sp.sortDir as "asc" | "desc") ?? "desc", page: sp.page ? Number(sp.page) : 1, pageSize: 10,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load TRFs.";
  }

  const canCreate = canTrf(actor, "create");
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Test Request Forms"
        description="Create, submit and track Test Request Forms (TRF) from accepted quotations through to technical review."
        actions={canCreate ? <Link href="/trfs/new" className={PRIMARY_BTN}><Plus className="h-4 w-4" /> Create TRF</Link> : undefined}
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
            <StatCard label="Total TRFs" value={result!.stats.total} icon={<ClipboardList className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Draft" value={result!.stats.draft} icon={<FileEdit className="h-4 w-4" />} tone="zinc" />
            <StatCard label="Submitted" value={result!.stats.submitted} icon={<Send className="h-4 w-4" />} tone="blue" />
            <StatCard label="Under review" value={result!.stats.underReview} icon={<Hourglass className="h-4 w-4" />} tone="violet" />
            <StatCard label="Accepted" value={result!.stats.accepted} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="On hold" value={result!.stats.onHold} icon={<PauseCircle className="h-4 w-4" />} tone="amber" />
            <StatCard label="Rejected" value={result!.stats.rejected} icon={<XCircle className="h-4 w-4" />} tone="red" />
          </div>

          <TrfFilters />

          <DataTable>
            <THead>
              <Th><Link href={sortLink(sp, "trfCode")} className="inline-flex items-center gap-1">TRF Number <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th>Customer</Th><Th>Quotation</Th><Th># Samples</Th><Th>Products</Th>
              <Th>Submitted</Th>
              <Th><Link href={sortLink(sp, "requestedDueDate")} className="inline-flex items-center gap-1">Due Date <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th>Priority</Th>
              <Th><Link href={sortLink(sp, "status")} className="inline-flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th>Created By</Th><Th>Actions</Th>
            </THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((t) => (
                <Tr key={t.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/trfs/${t.id}`}>{t.trfCode ?? `Draft (${t.id})`}</Link></Td>
                  <Td className="font-medium"><Link href={`/clients/${t.customerId}`} className="text-brand-600 hover:underline">{t.customer?.name}</Link></Td>
                  <Td className="text-xs"><Link href={`/quotations/${t.quotationId}`} className="text-brand-600 hover:underline">{t.quotation?.quotationCode}</Link></Td>
                  <Td className="text-xs">{t.samples.length}</Td>
                  <Td className="text-xs">{t.samples.slice(0, 2).map((s: { sampleName: string }) => s.sampleName).join(", ")}{t.samples.length > 2 ? ` +${t.samples.length - 2}` : ""}</Td>
                  <Td className="text-xs">{t.submittedAt ? formatDate(t.submittedAt) : "—"}</Td>
                  <Td className="text-xs">{t.requestedDueDate ? formatDate(t.requestedDueDate) : "—"}</Td>
                  <Td className="text-xs">{t.priority}</Td>
                  <Td><StatusBadge status={t.status} dot /></Td>
                  <Td className="text-xs">{t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "—"}</Td>
                  <Td><Link href={`/trfs/${t.id}`} className="text-xs text-brand-600 hover:underline">Open</Link></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={11} message="No TRFs match the current filters." /> : null}
            </TBody>
          </DataTable>

          {result!.total > result!.pageSize ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Page {result!.page} of {totalPages} · {result!.total} TRFs</span>
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
