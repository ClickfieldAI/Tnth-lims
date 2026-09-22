import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      samples: true,
      products: true,
      invoices: true,
      users: true,
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Client Companies"
        description="Pharmaceutical manufacturers and sponsors submitting samples for GMP-compliant testing."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active clients" value={clients.filter((c) => c.isActive).length} icon={<Building2 className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Samples submitted" value={clients.reduce((a, c) => a + c.samples.length, 0)} tone="blue" />
        <StatCard label="Products registered" value={clients.reduce((a, c) => a + c.products.length, 0)} tone="violet" />
        <StatCard label="Open invoices" value={clients.reduce((a, c) => a + c.invoices.filter((i) => i.status === "UNPAID").length, 0)} tone="amber" />
      </div>

      <DataTable>
        <THead>
          <Th>Code</Th><Th>Company</Th><Th>Contact</Th><Th>Country</Th><Th>Users</Th><Th>Samples</Th><Th>Products</Th><Th>Status</Th>
        </THead>
        <TBody>
          {clients.map((c) => (
            <Tr key={c.id} className="hover:bg-slate-50">
              <Td className="font-mono text-[11px] font-semibold">
                <Link href={`/clients/${c.id}`} className="block">{c.code}</Link>
              </Td>
              <Td className="font-medium">
                <Link href={`/clients/${c.id}`} className="block text-brand-600 hover:underline">{c.name}</Link>
              </Td>
              <Td className="text-xs">
                {c.contactPerson ?? "—"}
                <span className="block text-[11px] text-slate-400">{c.email ?? ""}</span>
              </Td>
              <Td>{c.country ?? "—"}</Td>
              <Td>{c.users.length}</Td>
              <Td>{c.samples.length}</Td>
              <Td>{c.products.length}</Td>
              <Td><StatusBadge status={c.isActive ? "ACTIVE" : "CLOSED"} dot /></Td>
            </Tr>
          ))}
          {!clients.length ? <TableEmpty colSpan={8} message="No client companies yet." /> : null}
        </TBody>
      </DataTable>

      <div className="grid gap-4 lg:grid-cols-2">
        {clients.slice(0, 4).map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">{c.name}</p>
            <p className="mt-1 text-xs text-slate-500">{c.industry ?? "Pharmaceutical"} · {c.city ?? c.country ?? ""}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.products.slice(0, 5).map((p) => (
                <Badge key={p.id} tone="indigo">{p.name}</Badge>
              ))}
              {!c.products.length ? <span className="text-xs text-slate-400">No products</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}