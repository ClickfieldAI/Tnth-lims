import { TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card } from "@/components/ui/card";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { NewDeviationButton } from "./new-deviation";
import { DeviationActions } from "./deviation-actions";

export const metadata = { title: "Deviations" };

export default async function DeviationsPage() {
  const deviations = await prisma.deviation.findMany({
    orderBy: { createdAt: "desc" },
    include: { sample: true, test: true },
    take: 100,
  });

  const open = deviations.filter((d) => ["OPEN", "INVESTIGATING"].includes(d.status)).length;
  const critical = deviations.filter((d) => d.impactLevel === "CRITICAL").length;
  const closed = deviations.filter((d) => d.status === "CLOSED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality"
        title="Deviation Management"
        description="Planned and unplanned departures from approved procedures — investigation through closure."
        image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=640&q=65&auto=format&fit=crop"
        actions={<NewDeviationButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open deviations" value={open} icon={<TriangleAlert className="h-4 w-4" />} tone={open ? "amber" : "green"} />
        <StatCard label="Critical impact" value={critical} tone={critical ? "red" : "slate"} />
        <StatCard label="Closed" value={closed} tone="green" />
        <StatCard label="Total records" value={deviations.length} tone="indigo" />
      </div>

      <DataTable>
        <THead>
          <Th>Deviation</Th><Th>Description</Th><Th>Category</Th><Th>Impact</Th><Th>Root cause</Th><Th>Raised</Th><Th>Status</Th><Th>Action</Th>
        </THead>
        <TBody>
          {deviations.map((d) => (
            <Tr key={d.id}>
              <Td className="font-medium">{d.deviationId}</Td>
              <Td className="max-w-[280px] truncate">{d.description}</Td>
              <Td><Badge tone="slate">{d.category}</Badge></Td>
              <Td><Badge tone={d.impactLevel === "CRITICAL" ? "red" : d.impactLevel === "MAJOR" ? "amber" : "zinc"}>{d.impactLevel ?? "—"}</Badge></Td>
              <Td className="max-w-[180px] truncate text-xs text-slate-500">{d.rootCause ?? "Under investigation"}</Td>
              <Td className="text-xs">{formatDateTime(d.createdAt)}</Td>
              <Td><StatusBadge status={d.status === "INVESTIGATING" ? "REVIEW" : d.status} dot /></Td>
              <Td><DeviationActions devId={d.id} status={d.status} /></Td>
            </Tr>
          ))}
          {!deviations.length ? <TableEmpty colSpan={8} message="No deviations recorded." /> : null}
        </TBody>
      </DataTable>

      <Card className="px-5 py-4 text-xs text-slate-500">
        Out-of-specification (OOS) assay results automatically raise a deviation for QA investigation,
        ensuring no failed result escapes the CAPA system.
      </Card>
    </div>
  );
}