import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { asArray, testTypeLabel } from "@/lib/utils";

export const metadata = { title: "My samples" };

export default async function ClientSamplesPage() {
  const user = await getCurrentUser();
  if (!user?.clientId) return <p className="text-sm text-slate-500">No client company linked.</p>;

  const samples = await prisma.sample.findMany({
    where: { clientId: user.clientId },
    orderBy: { receivedDate: "desc" },
    include: { tests: true },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="My Account"
        title="My Samples"
        description="Every sample you have submitted, with live testing status."
        image="https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=1000&q=80&auto=format&fit=crop"
        actions={
          <Link href="/client/samples/new" className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Submit a sample
          </Link>
        }
      />

      <DataTable>
        <THead>
          <Th>Sample</Th><Th>Product</Th><Th>Batch</Th><Th>Requested tests</Th><Th>Received</Th><Th>Tests</Th><Th>Status</Th>
        </THead>
        <TBody>
          {samples.map((s) => (
            <Tr key={s.id}>
              <Td className="font-medium">{s.sampleCode}</Td>
              <Td className="max-w-[200px] truncate">{s.productName ?? "—"}</Td>
              <Td className="text-xs">{s.batchNumber ?? "—"}</Td>
              <Td className="text-xs">{asArray(s.requestedTests).map(testTypeLabel).join(", ") || "—"}</Td>
              <Td className="text-xs">{formatDate(s.receivedDate)}</Td>
              <Td>{s.tests.length}</Td>
              <Td><StatusBadge status={s.status} dot /></Td>
            </Tr>
          ))}
          {!samples.length ? <TableEmpty colSpan={7} message="No samples submitted yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}