import { Microscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card } from "@/components/ui/card";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Instruments" };

const CATEGORY_LABEL: Record<string, string> = {
  HPLC: "HPLC System", GC: "GC System", DISSOLUTION: "Dissolution Apparatus",
  MICROBIOLOGY: "Microbiology", STABILITY_CHAMBER: "Stability Chamber",
  SPECTROPHOTOMETER: "Spectrophotometer",
};

export default async function InstrumentsPage() {
  const instruments = await prisma.instrument.findMany({
    orderBy: { code: "asc" },
    include: { tests: true, calibrations: true, maintenanceLogs: true },
  });

  const dueCalibration = instruments.filter((i) => i.calibrationStatus !== "VALID").length;
  const inUse = instruments.filter((i) => i.status === "IN_USE").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Instrument Management"
        description="HPLC, GC and supporting analytical systems with calibration scheduling and maintenance history."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Instruments" value={instruments.length} icon={<Microscope className="h-4 w-4" />} tone="indigo" />
        <StatCard label="In use" value={inUse} tone="blue" />
        <StatCard label="Calibration due/expired" value={dueCalibration} tone={dueCalibration ? "red" : "green"} />
        <StatCard label="Maintenance records" value={instruments.reduce((a, i) => a + i.maintenanceLogs.length, 0)} tone="slate" />
      </div>

      <DataTable>
        <THead>
          <Th>ID</Th><Th>System</Th><Th>Type</Th><Th>Manufacturer / model</Th><Th>Status</Th><Th>Last calibrated</Th><Th>Next due</Th><Th>Calibration</Th>
        </THead>
        <TBody>
          {instruments.map((i) => (
            <Tr key={i.id}>
              <Td className="font-mono text-[11px] font-semibold">{i.code}</Td>
              <Td className="max-w-[180px] truncate">{i.name}</Td>
              <Td><Badge tone="slate">{CATEGORY_LABEL[i.category] ?? i.category}</Badge></Td>
              <Td className="text-xs text-slate-500">{[i.manufacturer, i.model].filter(Boolean).join(" · ") || "—"}</Td>
              <Td><StatusBadge status={i.status} dot /></Td>
              <Td className="text-xs">{formatDate(i.lastCalibrated)}</Td>
              <Td className="text-xs">{formatDate(i.nextCalibration)}</Td>
              <Td><StatusBadge status={i.calibrationStatus} dot /></Td>
            </Tr>
          ))}
          {!instruments.length ? <TableEmpty colSpan={8} message="No instruments registered." /> : null}
        </TBody>
      </DataTable>

      <Card className="px-5 py-4 text-xs text-slate-500">
        Chromatograms and raw instrument files attach to the originating test worksheet — see the Testing modules.
        Calibration reminders are driven from each system&apos;s next-due date above.
      </Card>
    </div>
  );
}