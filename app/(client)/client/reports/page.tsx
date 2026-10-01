import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { listReleasedReportsForCustomer } from "@/lib/delivery/service";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PdfExportButton } from "@/app/(dashboard)/reports/pdf-button";

export const metadata = { title: "Reports" };

export default async function ClientReportsPage() {
  const user = await getCurrentUser();
  if (!user?.clientId) return <p className="text-sm text-slate-500">No client company linked.</p>;

  const [reports, foodTestingReports] = await Promise.all([
    prisma.testReport.findMany({
      where: {
        sample: { clientId: user.clientId },
        status: { in: ["APPROVED", "RELEASED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { sample: true, test: true },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listReleasedReportsForCustomer(user.clientId) as Promise<any[]>,
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Approved Reports & CoAs"
        description="Only QA-approved, released reports are visible here — download signed PDF copies at any time."
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

      <Card>
        <CardHeader title="Food Testing Certificates of Analysis" subtitle="Released reports from the TRF-based food testing workflow — only the released version is shown; internal QA history is not." />
        <div className="px-1 pb-1">
          <DataTable>
            <THead><Th>Report #</Th><Th>Sample</Th><Th>Released</Th><Th>Delivery Status</Th></THead>
            <TBody>
              {foodTestingReports.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-mono text-[11px] font-semibold">{r.reportCode}</Td>
                  <Td className="max-w-[220px] truncate text-xs">{r.sampleRegistration?.sampleCode ?? "—"}</Td>
                  <Td className="text-xs">{formatDate(r.release?.releasedAt)}</Td>
                  <Td><StatusBadge status={r.deliveries?.[0]?.status ?? "PENDING"} dot /></Td>
                </Tr>
              ))}
              {!foodTestingReports.length ? <TableEmpty colSpan={4} message="No released food testing reports yet." /> : null}
            </TBody>
          </DataTable>
        </div>
      </Card>
    </div>
  );
}