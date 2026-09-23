import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PdfExportButton } from "./pdf-button";
import { ReportActions } from "./report-actions";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const isClient = user?.role === "CLIENT";
  const canDecide = user?.role === "ADMIN" || user?.role === "QA" || user?.role === "MANAGER";

  const reports = await prisma.testReport.findMany({
    where: isClient && user?.clientId
      ? { sample: { clientId: user.clientId } }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { sample: { include: { client: true } }, test: true, approvedBy: true },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Reporting"
        description="Controlled test reports and Certificates of Analysis with digital signatures and approval history."
        image="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640&q=65&auto=format&fit=crop"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total reports" value={reports.length} icon={<FileText className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Released" value={reports.filter((r) => r.status === "RELEASED").length} tone="green" />
        <StatCard label="Approved" value={reports.filter((r) => r.status === "APPROVED").length} tone="blue" />
        <StatCard label="Draft" value={reports.filter((r) => r.status === "DRAFT").length} tone="amber" />
      </div>

      <DataTable>
        <THead>
          <Th>Report</Th><Th>Title</Th><Th>Sample</Th><Th>Client</Th><Th>Type</Th><Th>Created</Th><Th>Status</Th><Th>Signed off</Th><Th></Th>
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
              <Td className="text-xs text-slate-500">
                {r.approvedBy ? `${r.approvedBy.firstName} ${r.approvedBy.lastName} · ${formatDate(r.approvedAt)}` : "—"}
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <ReportActions reportId={r.id} status={r.status} canDecide={canDecide} />
                  {r.sample ? <PdfExportButton sampleId={r.sample.id} reportCode={r.reportCode} /> : null}
                </div>
              </Td>
            </Tr>
          ))}
          {!reports.length ? <TableEmpty colSpan={9} message="No reports generated yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}