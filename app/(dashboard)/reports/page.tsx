import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PdfExportButton } from "./pdf-button";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const isClient = user?.role === "CLIENT";

  const reports = await prisma.testReport.findMany({
    where: isClient && user?.clientId
      ? { sample: { clientId: user.clientId } }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { sample: { include: { client: true } }, test: true },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reporting"
        description="Controlled test reports and Certificates of Analysis with digital signatures and approval history."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total reports" value={reports.length} icon={<FileText className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Released" value={reports.filter((r) => r.status === "RELEASED").length} tone="green" />
        <StatCard label="Approved" value={reports.filter((r) => r.status === "APPROVED").length} tone="blue" />
        <StatCard label="Draft" value={reports.filter((r) => r.status === "DRAFT").length} tone="amber" />
      </div>

      <DataTable>
        <THead>
          <Th>Report</Th><Th>Title</Th><Th>Sample</Th><Th>Client</Th><Th>Type</Th><Th>Created</Th><Th>Status</Th><Th></Th>
        </THead>
        <TBody>
          {reports.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono text-[11px] font-medium">{r.reportCode}</Td>
              <Td className="max-w-[220px] truncate">{r.title}</Td>
              <Td>{r.sample?.sampleCode ?? "—"}</Td>
              <Td>{r.sample?.client.name ?? "—"}</Td>
              <Td><Badge tone="slate">{r.type}</Badge></Td>
              <Td className="text-xs">{formatDate(r.createdAt)}</Td>
              <Td><StatusBadge status={r.status} dot /></Td>
              <Td>
                <PdfExportButton
                  report={{
                    code: r.reportCode,
                    title: r.title,
                    sample: r.sample?.sampleCode ?? "—",
                    product: r.sample?.productName ?? "—",
                    batch: r.sample?.batchNumber ?? "—",
                    client: r.sample?.client.name ?? "—",
                    type: r.type,
                    status: r.status,
                    result: r.test?.result ?? null,
                    resultStatus: r.test?.resultStatus ?? null,
                    method: r.test?.method ?? null,
                    created: formatDate(r.createdAt),
                  }}
                />
              </Td>
            </Tr>
          ))}
          {!reports.length ? <TableEmpty colSpan={8} message="No reports generated yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}