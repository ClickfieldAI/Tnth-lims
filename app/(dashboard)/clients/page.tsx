import Link from "next/link";
import { Building2, UserCheck, UserX, CalendarPlus, Plus, ArrowUpDown } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listCustomers } from "@/lib/customers/service";
import { can } from "@/lib/customers/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CustomerFilters } from "./customer-filters";
import { RowActions } from "./status-actions";

export const metadata = { title: "Customer Master" };

// buttonClass() is a client-only helper (components/ui/button.tsx is "use
// client"); these two server pages just need the static class strings, so
// they're inlined here rather than importing it.
const PRIMARY_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-10 px-4 text-sm bg-brand-700 text-white shadow-[var(--shadow-xs)] hover:bg-brand-800 active:bg-brand-900";
const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

function sortLink(current: Search, key: string) {
  const dir = current.sortBy === key && current.sortDir !== "desc" ? "desc" : "asc";
  const params = new URLSearchParams(current as Record<string, string>);
  params.set("sortBy", key);
  params.set("sortDir", dir);
  return `?${params.toString()}`;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let result;
  let loadError: string | null = null;
  try {
    result = await listCustomers(
      { id: user.id, role: user.role, clientId: user.clientId },
      {
        search: sp.q,
        type: sp.type,
        status: (sp.status as "active" | "inactive" | "all") ?? "all",
        createdFrom: sp.from,
        createdTo: sp.to,
        sortBy: (sp.sortBy as "name" | "code" | "createdAt" | "customerType" | "status") ?? "createdAt",
        sortDir: (sp.sortDir as "asc" | "desc") ?? "desc",
        page: sp.page ? Number(sp.page) : 1,
        pageSize: 10,
      },
    );
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load customers.";
  }

  const canManage = can({ role: user.role }, "create");
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Customer Master"
        description="Manage customer profiles, contacts, addresses, and business information."
        image="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&q=65&auto=format&fit=crop"
        actions={canManage ? (
          <Link href="/clients/new" className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" /> Add Customer
          </Link>
        ) : undefined}
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total customers" value={result!.stats.total} icon={<Building2 className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Active" value={result!.stats.active} icon={<UserCheck className="h-4 w-4" />} tone="green" />
            <StatCard label="Inactive" value={result!.stats.inactive} icon={<UserX className="h-4 w-4" />} tone="zinc" />
            <StatCard label="Added this month" value={result!.stats.addedThisMonth} icon={<CalendarPlus className="h-4 w-4" />} tone="blue" />
          </div>

          <CustomerFilters />

          <DataTable>
            <THead>
              <Th><Link href={sortLink(sp, "code")} className="inline-flex items-center gap-1">Customer ID <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th><Link href={sortLink(sp, "name")} className="inline-flex items-center gap-1">Company Name <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th><Link href={sortLink(sp, "customerType")} className="inline-flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th>Primary Contact</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>GST Number</Th>
              <Th><Link href={sortLink(sp, "status")} className="inline-flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th><Link href={sortLink(sp, "createdAt")} className="inline-flex items-center gap-1">Created <ArrowUpDown className="h-3 w-3" /></Link></Th>
              <Th>Actions</Th>
            </THead>
            <TBody>
              {result!.rows.map((c) => (
                <Tr key={c.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/clients/${c.id}`}>{c.code}</Link></Td>
                  <Td className="font-medium"><Link href={`/clients/${c.id}`} className="text-brand-600 hover:underline">{c.name}</Link></Td>
                  <Td className="text-xs">{c.customerType}</Td>
                  <Td className="text-xs">{c.contactPerson || "—"}</Td>
                  <Td className="text-xs">{c.email || "—"}</Td>
                  <Td className="text-xs">{c.phone || "—"}</Td>
                  <Td className="font-mono text-[11px]">{c.gstNumber || "—"}</Td>
                  <Td><StatusBadge status={c.isActive ? "ACTIVE" : "CLOSED"} dot /></Td>
                  <Td className="text-xs">{formatDate(c.createdAt)}</Td>
                  <Td><RowActions id={c.id} isActive={c.isActive} canManage={canManage} /></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={10} message="No customers match the current filters." /> : null}
            </TBody>
          </DataTable>

          {result!.total > result!.pageSize ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Page {result!.page} of {totalPages} · {result!.total} customers</span>
              <div className="flex gap-2">
                {result!.page > 1 ? (
                  <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page - 1) } as Record<string, string>).toString()}`}>Previous</Link>
                ) : null}
                {result!.page < totalPages ? (
                  <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page + 1) } as Record<string, string>).toString()}`}>Next</Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
