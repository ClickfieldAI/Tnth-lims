import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PdfExportButton } from "@/app/(dashboard)/reports/pdf-button";

export const metadata = { title: "Reports" };

export default async function ClientReportsPage() {
  const user = await getCurrentUser();
  if (!user?.clientId) return <p className="text-sm text-slate-500">No client company linked.</p>;

  const reports = await prisma.testReport.findMany({
    where: {
      sample: { clientId: user.clientId },
      status: { in: ["APPROVED", "RELEASED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { sample: true, test: true },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Approved Reports & CoAs"
        description="Only QA-approved reports are visible here — download signed PDF copies at any time."
        image="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640&q=65&auto=format&fit=crop"
      />

      <DataTable>
        <THead>
          <Th>Report</Th><Th>Product</Th><Th>Batch</Th><Th>Type</Th><Th>Date</Th><Th>Status</Th><Th></Th>
        </THead>
        <TBody>
          {reports.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono text-[11px] font-semibold">{r.reportCode}</Td>
              <Td className="max-w-[220px] truncate">{r.sample?.productName ?? "—"}</Td>
              <Td className="text-xs">{r.sample?.batchNumber ?? "—"}</Td>
              <Td className="text-xs">{r.type}</Td>
              <Td className="text-xs">{formatDate(r.createdAt)}</Td>
              <Td><StatusBadge status={r.status} dot /></Td>
              <Td>
                {r.sample ? <PdfExportButton sampleId={r.sample.id} reportCode={r.reportCode} /> : null}
              </Td>
            </Tr>
          ))}
          {!reports.length ? <TableEmpty colSpan={7} message="No approved reports available yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}