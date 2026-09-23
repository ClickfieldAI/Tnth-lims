import Link from "next/link";
import { Plus, FlaskConical } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Samples" };

const PRIORITY_TONE: Record<string, string> = {
  RUSH: "red", HIGH: "amber", NORMAL: "zinc", LOW: "slate",
};

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const isClient = user?.role === "CLIENT";

  const where = isClient && user?.clientId
    ? { clientId: user.clientId }
    : sp.status ? { status: sp.status } : undefined;

  const samples = await prisma.sample.findMany({
    where,
    orderBy: { receivedDate: "desc" },
    include: { client: true, assignedTo: true, tests: true },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Sample Management"
        description="Complete lifecycle — registration, assignment, testing and release with full chain of custody."
        image="https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=640&q=65&auto=format&fit=crop"
        actions={
          !isClient ? (
            <Link
              href="/samples/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> Register sample
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {[["", "All"], ["RECEIVED", "Received"], ["ASSIGNED", "Assigned"], ["TESTING", "Testing"], ["REVIEW", "In review"], ["APPROVED", "Approved"], ["RELEASED", "Released"]].map(([key, label]) => {
          const active = (sp.status ?? "") === key;
          return (
            <Link
              key={label}
              href={key ? `/samples?status=${key}` : "/samples"}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <DataTable>
        <THead>
          <Th>Sample</Th>
          <Th>Product / batch</Th>
          <Th>Client</Th>
          <Th>Priority</Th>
          <Th>Tests</Th>
          <Th>Analyst</Th>
          <Th>Received</Th>
          <Th>Status</Th>
        </THead>
        <TBody>
          {samples.map((s) => (
            <Tr key={s.id}>
              <Td>
                <Link href={`/samples/${s.id}`} className="font-medium text-brand-600 hover:underline">
                  {s.sampleCode}
                </Link>
              </Td>
              <Td className="max-w-[220px] truncate">{s.productName ?? "—"}<span className="block text-[11px] text-slate-400">{s.batchNumber ?? ""}</span></Td>
              <Td>{s.client.name}</Td>
              <Td><Badge tone={PRIORITY_TONE[s.priority] ?? "zinc"}>{s.priority}</Badge></Td>
              <Td>{s.tests.length}</Td>
              <Td>{s.assignedTo ? `${s.assignedTo.firstName} ${s.assignedTo.lastName}` : "—"}</Td>
              <Td>{formatDate(s.receivedDate)}</Td>
              <Td><StatusBadge status={s.status} dot /></Td>
            </Tr>
          ))}
          {!samples.length ? <TableEmpty colSpan={8} message="No samples match this filter." /> : null}
        </TBody>
      </DataTable>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <FlaskConical className="h-3.5 w-3.5" />
        Every sample carries a unique barcode and a complete chain-of-custody history.
      </p>
    </div>
  );
}