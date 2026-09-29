import Link from "next/link";
import { Inbox, Sparkles, Hourglass, CheckCircle2, XCircle, Plus, ArrowUpDown } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listEnquiries } from "@/lib/enquiries/service";
import { canEnquiry } from "@/lib/enquiries/access";
import { ENQUIRY_STATUS_LABEL } from "@/lib/enquiries/validation";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { EnquiryFilters } from "./enquiry-filters";
import { RowActions } from "./enquiry-actions";

export const metadata = { title: "Enquiries" };

const PRIMARY_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-10 px-4 text-sm bg-brand-700 text-white shadow-[var(--shadow-xs)] hover:bg-brand-800 active:bg-brand-900";
const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

function sortLink(current: Search, key: string) {
  const dir = current.sortBy === key && current.sortDir !== "desc" ? "desc" : "asc";
  const params = new URLSearchParams(current as Record<string, string>);
  params.set("sortBy", key); params.set("sortDir", dir);
  return `?${params.toString()}`;
}

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  const [managerUsers, result] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.user.findMany({ include: { role: true } as any }).then((us) => (us as unknown as { id: string; firstName: string; lastName: string; role: { name: string } }[]).filter((u) => ["ADMIN", "MANAGER"].includes(u.role.name)).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))),
    listEnquiries(actor, {
      search: sp.q, status: sp.status !== "all" ? sp.status : undefined, managerId: sp.manager !== "all" ? sp.manager : undefined,
      quotationStatus: sp.qstatus !== "all" ? sp.qstatus : undefined, dateFrom: sp.from, dateTo: sp.to,
      sortBy: (sp.sortBy as "enquiryCode" | "enquiryDate" | "status") ?? "enquiryDate", sortDir: (sp.sortDir as "asc" | "desc") ?? "desc",
      page: sp.page ? Number(sp.page) : 1, pageSize: 10,
    }).catch((e) => ({ error: e instanceof Error ? e.message : "Failed to load enquiries." }) as const),
  ]);

  const canCreate = canEnquiry(actor, "create");
  const canClose = canEnquiry(actor, "close");

  if ("error" in result) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Business" title="Enquiries" description="Manage customer testing enquiries, requested services, and quotation preparation." />
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{result.error}</div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Enquiries"
        description="Manage customer testing enquiries, requested services, and quotation preparation."
        actions={canCreate ? <Link href="/enquiries/new" className={PRIMARY_BTN}><Plus className="h-4 w-4" /> New Enquiry</Link> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total enquiries" value={result.stats.total} icon={<Inbox className="h-4 w-4" />} tone="indigo" />
        <StatCard label="New" value={result.stats.new} icon={<Sparkles className="h-4 w-4" />} tone="blue" />
        <StatCard label="Pending quotation" value={result.stats.pendingQuotation} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
        <StatCard label="Accepted" value={result.stats.accepted} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <StatCard label="Rejected / closed" value={result.stats.rejectedClosed} icon={<XCircle className="h-4 w-4" />} tone="zinc" />
      </div>

      <EnquiryFilters managers={managerUsers} />

      <DataTable>
        <THead>
          <Th><Link href={sortLink(sp, "enquiryCode")} className="inline-flex items-center gap-1">Enquiry ID <ArrowUpDown className="h-3 w-3" /></Link></Th>
          <Th>Customer</Th>
          <Th><Link href={sortLink(sp, "enquiryDate")} className="inline-flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></Link></Th>
          <Th>Contact</Th>
          <Th>Requested Services</Th>
          <Th># Tests</Th>
          <Th>Est. Value</Th>
          <Th>TAT</Th>
          <Th>Manager</Th>
          <Th><Link href={sortLink(sp, "status")} className="inline-flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></Link></Th>
          <Th>Actions</Th>
        </THead>
        <TBody>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(result.rows as any[]).map((e) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tests = e.products.flatMap((p: any) => p.tests);
            const services = [...new Set(tests.map((t: { customRequest: boolean; customServiceName?: string; serviceId?: string }) => t.customRequest ? t.customServiceName : t.serviceId))].slice(0, 2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const latestQuotation = e.quotations.length ? e.quotations[e.quotations.length - 1] : null;
            return (
              <Tr key={e.id} className="hover:bg-slate-50">
                <Td className="font-mono text-[11px] font-semibold"><Link href={`/enquiries/${e.id}`}>{e.enquiryCode}</Link></Td>
                <Td className="font-medium"><Link href={`/clients/${e.customerId}`} className="text-brand-600 hover:underline">{e.customer?.name}</Link></Td>
                <Td className="text-xs">{formatDate(e.enquiryDate)}</Td>
                <Td className="text-xs">{e.customer?.contactPerson || "—"}</Td>
                <Td className="text-xs">{services.join(", ") || "—"}{tests.length > 2 ? ` +${tests.length - 2}` : ""}</Td>
                <Td className="text-xs">{tests.length}</Td>
                <Td className="text-xs">{latestQuotation ? formatCurrency(latestQuotation.grandTotal, "INR") : "—"}</Td>
                <Td className="text-xs">{e.requestedTurnaroundDays}d</Td>
                <Td className="text-xs">{e.assignedManager ? `${e.assignedManager.firstName} ${e.assignedManager.lastName}` : "—"}</Td>
                <Td><StatusBadge status={e.status} dot /></Td>
                <Td><RowActions id={e.id} canEdit={canEnquiry(actor, "edit")} canClose={canClose} closed={["CLOSED", "ACCEPTED", "REJECTED"].includes(e.status)} quotationId={latestQuotation?.id} /></Td>
              </Tr>
            );
          })}
          {!result.rows.length ? <TableEmpty colSpan={11} message="No enquiries match the current filters." /> : null}
        </TBody>
      </DataTable>

      <p className="text-[11px] text-slate-400">
        Testing services shown as slugs reference the {" "}
        <Link href="/industries/food-testing" className="underline">Food Testing service catalog</Link>.
      </p>

      {result.total > result.pageSize ? (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {result.page} of {totalPages} · {result.total} enquiries</span>
          <div className="flex gap-2">
            {result.page > 1 ? <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result.page - 1) } as Record<string, string>).toString()}`}>Previous</Link> : null}
            {result.page < totalPages ? <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result.page + 1) } as Record<string, string>).toString()}`}>Next</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
