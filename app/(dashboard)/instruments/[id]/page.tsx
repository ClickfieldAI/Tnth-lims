import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Microscope, Wrench, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, testTypeLabel } from "@/lib/utils";

export const metadata = { title: "Instrument detail" };

const CATEGORY_LABEL: Record<string, string> = {
  HPLC: "HPLC System", GC: "GC System", DISSOLUTION: "Dissolution Apparatus",
  MICROBIOLOGY: "Microbiology", STABILITY_CHAMBER: "Stability Chamber",
  SPECTROPHOTOMETER: "Spectrophotometer",
};

export default async function InstrumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instrument = await prisma.instrument.findUnique({
    where: { id },
    include: {
      tests: { include: { sample: { include: { client: true } } }, orderBy: { createdAt: "desc" } },
      calibrations: { orderBy: { performedAt: "desc" } },
      maintenanceLogs: { orderBy: { performedAt: "desc" } },
    },
  });
  if (!instrument) notFound();

  return (
    <div className="space-y-5">
      <Link href="/instruments" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to instruments
      </Link>

      <PageHeader
        title={instrument.name}
        description={`${instrument.code} · ${[instrument.manufacturer, instrument.model].filter(Boolean).join(" · ")}`}
        actions={<StatusBadge status={instrument.status} dot />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Category" value={CATEGORY_LABEL[instrument.category] ?? instrument.category} icon={<Microscope className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Tests executed" value={instrument.tests.length} tone="blue" />
        <StatCard label="Calibration" value={instrument.calibrationStatus} tone={instrument.calibrationStatus === "VALID" ? "green" : "red"} />
        <StatCard label="Maintenance records" value={instrument.maintenanceLogs.length} icon={<Wrench className="h-4 w-4" />} tone="slate" />
      </div>

      <Card>
        <CardHeader title="Calibration schedule" subtitle="Verification cadence for this system" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[11px] text-slate-400">Last calibrated</p>
            <p className="text-slate-800">{formatDate(instrument.lastCalibrated)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Next due</p>
            <p className="text-slate-800">{formatDate(instrument.nextCalibration)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Frequency</p>
            <p className="text-slate-800">{instrument.calibrationFrequency ? `${instrument.calibrationFrequency} days` : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Location</p>
            <p className="text-slate-800">{instrument.location ?? "—"}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tests run on this instrument" subtitle="Most recent first" />
        <DataTable>
          <THead><Th>Request</Th><Th>Sample</Th><Th>Client</Th><Th>Type</Th><Th>Result</Th><Th>Status</Th></THead>
          <TBody>
            {instrument.tests.map((t) => (
              <Tr key={t.id}>
                <Td><Link href={`/samples/${t.sampleId}`} className="font-medium text-brand-600 hover:underline">{t.requestCode}</Link></Td>
                <Td>{t.sample.sampleCode}</Td>
                <Td>{t.sample.client.name}</Td>
                <Td>{testTypeLabel(t.type)}</Td>
                <Td>{t.result ? <Badge tone={t.result === "PASS" ? "green" : "red"}>{t.result}</Badge> : "—"}</Td>
                <Td><StatusBadge status={t.status} dot /></Td>
              </Tr>
            ))}
            {!instrument.tests.length ? <TableEmpty colSpan={6} message="No tests recorded on this instrument yet." /> : null}
          </TBody>
        </DataTable>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Calibration records" subtitle="Historical verification log" />
          <div className="divide-y divide-slate-100">
            {instrument.calibrations.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-2.5 text-xs">
                <span className="text-slate-700">{formatDate(c.performedAt)}</span>
                <StatusBadge status={c.result ?? "PENDING"} dot />
              </div>
            ))}
            {!instrument.calibrations.length ? <p className="px-5 py-6 text-center text-xs text-slate-400">No calibration records.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Maintenance log" subtitle="Service history" />
          <div className="divide-y divide-slate-100">
            {instrument.maintenanceLogs.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-2.5 text-xs">
                <span className="text-slate-700">{formatDate(m.performedAt)} · {m.type}</span>
                <span className="text-slate-400">{m.description ?? ""}</span>
              </div>
            ))}
            {!instrument.maintenanceLogs.length ? (
              <p className="px-5 py-6 text-center text-xs text-slate-400">
                <CalendarClock className="mx-auto mb-1 h-4 w-4 text-slate-300" />
                No maintenance events logged.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
