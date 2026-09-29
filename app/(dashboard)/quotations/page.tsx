import Link from "next/link";
import { FileStack, FileEdit, Hourglass, Send, CheckCircle2, AlarmClock } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listQuotations } from "@/lib/enquiries/service";
import { canQuotation } from "@/lib/enquiries/access";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { QuotationFilters } from "./quotation-filters";

export const metadata = { title: "Quotations" };

const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

type Search = Record<string, string | undefined>;

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let result;
  let loadError: string | null = null;
  try {
    result = await listQuotations(actor, {
      search: sp.q, status: sp.status !== "all" ? sp.status : undefined, acceptanceStatus: sp.acceptance !== "all" ? sp.acceptance : undefined,
      dateFrom: sp.from, dateTo: sp.to, page: sp.page ? Number(sp.page) : 1, pageSize: 10,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load quotations.";
  }

  const canManage = canQuotation(actor, "create");
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Quotations"
        description="Manage testing quotations, pricing, approvals, and customer acceptance."
        actions={<Link href="/enquiries" className={SECONDARY_SM_BTN}>Create from an Enquiry</Link>}
      />

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Total quotations" value={result!.stats.total} icon={<FileStack className="h-4 w-4" />} tone="indigo" />
            <StatCard label="Draft" value={result!.stats.draft} icon={<FileEdit className="h-4 w-4" />} tone="zinc" />
            <StatCard label="Pending approval" value={result!.stats.pendingApproval} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
            <StatCard label="Sent" value={result!.stats.sent} icon={<Send className="h-4 w-4" />} tone="blue" />
            <StatCard label="Accepted" value={result!.stats.accepted} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
            <StatCard label="Expiring soon" value={result!.stats.expiringSoon} icon={<AlarmClock className="h-4 w-4" />} tone="red" />
          </div>

          <QuotationFilters />

          <DataTable>
            <THead>
              <Th>Quotation #</Th><Th>Enquiry</Th><Th>Customer</Th><Th>Date</Th><Th>Valid Until</Th>
              <Th># Tests</Th><Th>Subtotal</Th><Th>Discount</Th><Th>Tax</Th><Th>Total</Th><Th>Approval</Th><Th>Acceptance</Th><Th>Actions</Th>
            </THead>
            <TBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(result!.rows as any[]).map((q) => (
                <Tr key={q.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[11px] font-semibold"><Link href={`/quotations/${q.id}`}>{q.quotationCode}</Link>{q.revisionNumber > 1 ? <span className="ml-1 text-slate-400">Rev.{q.revisionNumber}</span> : null}</Td>
                  <Td><Link href={`/enquiries/${q.enquiryId}`} className="text-xs text-brand-600 hover:underline">{q.enquiry?.enquiryCode}</Link></Td>
                  <Td className="text-xs">{q.customer?.name}</Td>
                  <Td className="text-xs">{formatDate(q.quotationDate)}</Td>
                  <Td className="text-xs">{formatDate(q.validUntil)}</Td>
                  <Td className="text-xs">—</Td>
                  <Td className="text-xs">{formatCurrency(q.subtotal, "INR")}</Td>
                  <Td className="text-xs">{formatCurrency(q.discountTotal, "INR")}</Td>
                  <Td className="text-xs">{formatCurrency(q.taxTotal, "INR")}</Td>
                  <Td className="text-xs font-semibold">{formatCurrency(q.grandTotal, "INR")}</Td>
                  <Td><StatusBadge status={q.effectiveStatus} dot /></Td>
                  <Td><Badge tone={q.acceptanceStatus === "ACCEPTED" ? "green" : q.acceptanceStatus === "REJECTED" ? "red" : "slate"}>{q.acceptanceStatus}</Badge></Td>
                  <Td><Link href={`/quotations/${q.id}`} className="text-xs text-brand-600 hover:underline">Open</Link></Td>
                </Tr>
              ))}
              {!result!.rows.length ? <TableEmpty colSpan={13} message="No quotations match the current filters." /> : null}
            </TBody>
          </DataTable>

          {result!.total > result!.pageSize ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Page {result!.page} of {totalPages} · {result!.total} quotations</span>
              <div className="flex gap-2">
                {result!.page > 1 ? <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page - 1) } as Record<string, string>).toString()}`}>Previous</Link> : null}
                {result!.page < totalPages ? <Link className={SECONDARY_SM_BTN} href={`?${new URLSearchParams({ ...sp, page: String(result!.page + 1) } as Record<string, string>).toString()}`}>Next</Link> : null}
              </div>
            </div>
          ) : null}
          {!canManage ? <p className="text-[11px] text-slate-400">You have read-only access to quotations.</p> : null}
        </>
      )}
    </div>
  );
}
