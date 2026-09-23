import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Invoices" };

export default async function ClientInvoicesPage() {
  const user = await getCurrentUser();
  if (!user?.clientId) return <p className="text-sm text-slate-500">No client company linked.</p>;

  const invoices = await prisma.invoice.findMany({
    where: { clientId: user.clientId },
    orderBy: { issuedAt: "desc" },
    include: { samples: true },
  });

  const outstanding = invoices.filter((i) => i.status === "UNPAID")
    .reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Testing fees and payment status for your account."
        image="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=640&q=65&auto=format&fit=crop"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total invoiced" value={formatCurrency(invoices.reduce((a, i) => a + i.amount, 0))} tone="indigo" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} tone={outstanding ? "amber" : "green"} />
        <StatCard label="Paid" value={invoices.filter((i) => i.status === "PAID").length} tone="green" />
      </div>

      <DataTable>
        <THead>
          <Th>Invoice</Th><Th>Issued</Th><Th>Due</Th><Th>Samples</Th><Th>Amount</Th><Th>Status</Th>
        </THead>
        <TBody>
          {invoices.map((i) => (
            <Tr key={i.id}>
              <Td className="font-mono text-[11px] font-semibold">{i.number}</Td>
              <Td className="text-xs">{formatDate(i.issuedAt)}</Td>
              <Td className="text-xs">{formatDate(i.dueAt)}</Td>
              <Td>{i.samples.length}</Td>
              <Td className="font-medium">{formatCurrency(i.amount, i.currency)}</Td>
              <Td><StatusBadge status={i.status} dot /></Td>
            </Tr>
          ))}
          {!invoices.length ? <TableEmpty colSpan={6} message="No invoices issued." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}