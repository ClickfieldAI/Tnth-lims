import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/forms";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatDateTime, asArray, testTypeLabel } from "@/lib/utils";
import { SampleWorkflow } from "./workflow";

export const metadata = { title: "Sample detail" };

const FLOW = ["RECEIVED", "LOGGED", "ASSIGNED", "TESTING", "REVIEW", "APPROVED", "RELEASED"];

export default async function SampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = await prisma.sample.findUnique({
    where: { id },
    include: {
      client: true, product: true, batch: true,
      assignedTo: true, createdBy: true,
      tests: { include: { assignedTo: true, instrument: true } },
      custodyRecords: { orderBy: { at: "asc" } },
    },
  });
  if (!sample) notFound();

  const stageIdx = FLOW.indexOf(sample.status);
  const analysts = await prisma.user.findMany({
    where: { role: { name: { in: ["ANALYST", "MICRO"] } }, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <div className="space-y-5">
      <Link href="/samples" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to samples
      </Link>

      <PageHeader
        title={sample.sampleCode}
        description={`${sample.productName ?? "Product"} · Batch ${sample.batchNumber ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={sample.status} dot />
            <Badge tone={sample.priority === "RUSH" ? "red" : sample.priority === "HIGH" ? "amber" : "zinc"}>
              {sample.priority}
            </Badge>
          </div>
        }
      />

      {/* Workflow timeline */}
      <Card><CardContent className="overflow-x-auto"><WorkflowTimeline stageIdx={stageIdx} /></CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <InfoCard sample={{
            clientName: sample.client.name,
            productName: sample.productName,
            batchNumber: sample.batchNumber,
            mfgDate: sample.mfgDate,
            expDate: sample.expDate,
            quantity: sample.quantity,
            unit: sample.unit,
            storageCondition: sample.storageCondition,
            storageLocation: sample.storageLocation,
            receivedDate: sample.receivedDate,
            registeredBy: sample.createdBy ? `${sample.createdBy.firstName} ${sample.createdBy.lastName}` : null,
            requestedTests: sample.requestedTests,
            notes: sample.notes,
          }} />
          <TestsTable tests={sample.tests.map((t) => ({
            id: t.id, requestCode: t.requestCode, type: t.type, method: t.method,
            resultStatus: t.resultStatus, status: t.status,
            analystName: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : null,
            instrumentCode: t.instrument?.code ?? null,
          }))} />
          <CustodyLog records={sample.custodyRecords.map((c) => ({
            id: c.id, action: c.action, at: formatDateTime(c.at),
            location: c.locationNote ?? "Lab", note: c.note,
          }))} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Barcode tracking" subtitle="Scan for instant retrieval" />
            <CardContent><SampleBarcode code={sample.barcode} /></CardContent>
          </Card>
          <Card>
            <CardHeader title="Workflow actions" subtitle="Assign analyst & progress state" />
            <CardContent>
              <SampleWorkflow
                sampleId={sample.id}
                status={sample.status}
                analysts={analysts.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }))}
                currentAnalyst={sample.assignedTo?.id ?? null}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WorkflowTimeline({ stageIdx }: { stageIdx: number }) {
  return (
    <div className="flex min-w-[640px] items-center">
      {FLOW.map((stage, i) => (
        <div key={stage} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${i <= stageIdx ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              {i + 1}
            </span>
            <span className={`text-center text-[10px] font-medium leading-tight ${i <= stageIdx ? "text-slate-700" : "text-slate-400"}`}>
              {stage.charAt(0) + stage.slice(1).toLowerCase()}
            </span>
          </div>
          {i < FLOW.length - 1 ? (
            <div className={`mx-1 h-0.5 flex-1 rounded ${i < stageIdx ? "bg-brand-600" : "bg-slate-200"}`} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

function SampleBarcode({ code }: { code: string }) {
  const bars = Array.from(code).map((ch) => (ch.charCodeAt(0) % 4) + 1);
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <svg viewBox="0 0 120 34" className="mx-auto h-12 w-full max-w-[220px]">
        {bars.map((w, i) => (
          <rect key={i} x={(i * 5) % 118} y="2" width={w + 0.6} height="24" fill="#0f172a" />
        ))}
      </svg>
      <p className="mt-1 font-mono text-[11px] tracking-widest text-slate-600">{code}</p>
    </div>
  );
}
type TestRow = {
  id: string; requestCode: string; type: string; method: string | null;
  resultStatus: string | null; status: string;
  analystName: string | null; instrumentCode: string | null;
};

type CustodyRow = { id: string; action: string; at: string; location: string; note?: string | null };

type SampleInfo = {
  clientName: string; productName: string | null; batchNumber: string | null;
  mfgDate: Date | null; expDate: Date | null; quantity: number | null; unit: string | null;
  storageCondition: string | null; storageLocation: string | null;
  receivedDate: Date; registeredBy: string | null; requestedTests: unknown; notes: string | null;
};

function InfoCard({ sample }: { sample: SampleInfo }) {
  const requested = asArray(sample.requestedTests);
  return (
    <Card>
      <CardHeader title="Sample information" subtitle="Registration & storage record" />
      <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Info label="Client company" value={sample.clientName} />
        <Info label="Product name" value={sample.productName ?? "—"} />
        <Info label="Batch number" value={sample.batchNumber ?? "—"} />
        <Info label="Manufacturing date" value={formatDate(sample.mfgDate)} />
        <Info label="Expiry date" value={formatDate(sample.expDate)} />
        <Info label="Quantity received" value={sample.quantity ? `${sample.quantity} ${sample.unit ?? ""}` : "—"} />
        <Info label="Storage condition" value={sample.storageCondition || "—"} />
        <Info label="Storage location" value={sample.storageLocation || "—"} />
        <Info label="Received date" value={formatDate(sample.receivedDate)} />
        <Info label="Registered by" value={sample.registeredBy ?? "—"} />
        <div className="sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Requested tests</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {requested.map((t) => (
              <Badge key={String(t)} tone="indigo">{testTypeLabel(String(t))}</Badge>
            ))}
          </div>
        </div>
        {sample.notes ? (
          <div className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{sample.notes}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
function TestsTable({ tests }: { tests: TestRow[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Test requests ({tests.length})</h2>
      <DataTable>
        <THead>
          <Th>Request</Th><Th>Type</Th><Th>Method</Th><Th>Analyst</Th><Th>Instrument</Th><Th>Result</Th><Th>Status</Th>
        </THead>
        <TBody>
          {tests.map((t) => (
            <Tr key={t.id}>
              <Td className="font-medium">{t.requestCode}</Td>
              <Td>{testTypeLabel(t.type)}</Td>
              <Td className="max-w-[200px] truncate text-xs text-slate-500">{t.method ?? "—"}</Td>
              <Td>{t.analystName ?? "—"}</Td>
              <Td>{t.instrumentCode ?? "—"}</Td>
              <Td>
                {t.resultStatus ? (
                  <Badge tone={t.resultStatus === "PASS" ? "green" : t.resultStatus === "FAIL" ? "red" : "amber"}>
                    {t.resultStatus}
                  </Badge>
                ) : "—"}
              </Td>
              <Td><StatusBadge status={t.status} dot /></Td>
            </Tr>
          ))}
          {!tests.length ? <TableEmpty colSpan={7} message="No test requests yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}

function CustodyLog({ records }: { records: { id: string; action: string; at: string; location: string; note?: string | null }[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Chain of custody</h2>
      <ol className="relative space-y-4 border-l border-slate-200 pl-5">
        {records.map((c) => (
          <li key={c.id} className="relative">
            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
            <p className="text-sm font-medium capitalize text-slate-800">{c.action.toLowerCase()}</p>
            <p className="text-xs text-slate-500">{c.at} · {c.location}</p>
            {c.note ? <p className="mt-0.5 text-xs text-slate-400">{c.note}</p> : null}
          </li>
        ))}
        {!records.length ? <li className="text-xs text-slate-400">No custody records.</li> : null}
      </ol>
    </div>
  );
}