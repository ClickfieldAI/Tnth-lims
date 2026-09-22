import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FlaskConical, Package, Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";

export const metadata = { title: "Client detail" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      samples: { orderBy: { receivedDate: "desc" }, include: { tests: true } },
      products: true,
      invoices: { orderBy: { issuedAt: "desc" } },
      users: true,
    },
  });
  if (!client) notFound();

  const totalTests = client.samples.reduce((a, s) => a + s.tests.length, 0);
  const unpaidTotal = client.invoices.filter((i) => i.status === "UNPAID").reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-5">
      <Link href="/clients" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to clients
      </Link>

      <PageHeader
        title={client.name}
        description={`${client.code} · ${client.industry ?? "—"} · ${[client.city, client.country].filter(Boolean).join(", ")}`}
        actions={<StatusBadge status={client.isActive ? "ACTIVE" : "CLOSED"} dot />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Samples submitted" value={client.samples.length} icon={<FlaskConical className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Tests run" value={totalTests} tone="blue" />
        <StatCard label="Products registered" value={client.products.length} icon={<Package className="h-4 w-4" />} tone="violet" />
        <StatCard label="Unpaid balance" value={formatCurrency(unpaidTotal, "INR")} icon={<Receipt className="h-4 w-4" />} tone={unpaidTotal ? "red" : "green"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Contact" subtitle="Primary account contact" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 text-sm">
            <div>
              <p className="text-[11px] text-slate-400">Contact person</p>
              <p className="text-slate-800">{client.contactPerson ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Email</p>
              <p className="text-slate-800">{client.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Phone</p>
              <p className="text-slate-800">{client.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Users with portal access</p>
              <p className="text-slate-800">{client.users.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Products" subtitle="Registered items" />
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">
            {client.products.map((p) => <Badge key={p.id} tone="indigo">{p.name}</Badge>)}
            {!client.products.length ? <span className="text-xs text-slate-400">No products registered.</span> : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Samples" subtitle="All registrations from this client" />
        <DataTable>
          <THead><Th>Sample</Th><Th>Product</Th><Th>Tests</Th><Th>Received</Th><Th>Status</Th></THead>
          <TBody>
            {client.samples.map((s) => (
              <Tr key={s.id}>
                <Td><Link href={`/samples/${s.id}`} className="font-medium text-brand-600 hover:underline">{s.sampleCode}</Link></Td>
                <Td>{s.productName ?? "—"}</Td>
                <Td>{s.tests.length}</Td>
                <Td className="text-xs">{formatDate(s.receivedDate)}</Td>
                <Td><StatusBadge status={s.status} dot /></Td>
              </Tr>
            ))}
            {!client.samples.length ? <TableEmpty colSpan={5} message="No samples yet." /> : null}
          </TBody>
        </DataTable>
      </Card>

      <Card>
        <CardHeader title="Invoices" subtitle="Billing history" />
        <DataTable>
          <THead><Th>Number</Th><Th>Amount</Th><Th>Issued</Th><Th>Due</Th><Th>Status</Th></THead>
          <TBody>
            {client.invoices.map((inv) => (
              <Tr key={inv.id}>
                <Td className="font-medium">{inv.number}</Td>
                <Td>{formatCurrency(inv.amount, inv.currency)}</Td>
                <Td className="text-xs">{formatDate(inv.issuedAt)}</Td>
                <Td className="text-xs">{formatDate(inv.dueAt)}</Td>
                <Td><StatusBadge status={inv.status} dot /></Td>
              </Tr>
            ))}
            {!client.invoices.length ? <TableEmpty colSpan={5} message="No invoices yet." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );
}
