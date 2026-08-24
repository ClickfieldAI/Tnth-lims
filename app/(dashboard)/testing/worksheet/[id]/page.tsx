import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/forms";
import { formatDateTime } from "@/lib/utils";
import { WorksheetForm, ReviewActions } from "./worksheet-form";

export const metadata = { title: "Test worksheet" };

export default async function WorksheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      sample: { include: { client: true } },
      assignedTo: true,
      instrument: true,
      assayResult: true,
      dissolution: true,
      impurityResult: true,
      microbiology: true,
    },
  });
  if (!test) notFound();

  const instruments = await prisma.instrument.findMany({
    where: { status: { in: ["AVAILABLE", "IN_USE"] } },
    select: { id: true, code: true, name: true },
  });

  const canReview = user?.role === "QA" || user?.role === "MANAGER" || user?.role === "ADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href={`/samples/${test.sampleId}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {test.sample.sampleCode}
      </Link>

      <PageHeader
        title={test.requestCode}
        description={`${test.testName} · ${test.sample.productName ?? ""}`}
        actions={<StatusBadge status={test.status} dot />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Test request" subtitle="Method & assignment" />
          <CardContent className="space-y-2 text-sm">
            <Row label="Type" value={test.type.replace("_", " ")} />
            <Row label="Method" value={test.method ?? "—"} />
            <Row label="Analyst" value={test.assignedTo ? `${test.assignedTo.firstName} ${test.assignedTo.lastName}` : "Unassigned"} />
            <Row label="Instrument" value={test.instrument ? `${test.instrument.code} — ${test.instrument.name}` : "Not selected"} />
            <Row label="Client" value={test.sample.client.name} />
            <Row label="Started" value={formatDateTime(test.startedAt)} />
            <Divider />
            <Row label="Result" value={
              test.resultStatus
                ? `${test.result ?? ""} ${test.resultStatus}`
                : "Pending entry"
            } />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <WorksheetForm
            testId={test.id}
            type={test.type}
            status={test.status}
            instruments={instruments}
            assay={test.assayResult ? {
              expectedLow: test.assayResult.expectedLow,
              expectedHigh: test.assayResult.expectedHigh,
              resultPercent: test.assayResult.resultPercent,
            } : null}
            dissolution={test.dissolution ? {
              apparatus: test.dissolution.apparatus, medium: test.dissolution.medium,
              rpm: test.dissolution.rpm, temperature: test.dissolution.temperature,
              timepoints: Array.isArray(test.dissolution.timepoints) ? test.dissolution.timepoints as { t?: number; p?: number; time?: number; dissolvedPercent?: number }[] : [],
            } : null}
            observations={test.worksheetData && typeof test.worksheetData === "object"
              ? String((test.worksheetData as Record<string, unknown>).observations ?? "")
              : ""}
          />

          {canReview && test.status === "REVIEW" ? (
            <Card>
              <CardHeader title="QA review decision" subtitle="Approving generates a controlled report and advances the sample." />
              <CardContent><ReviewActions testId={test.id} /></CardContent>
            </Card>
          ) : null}

          {/* Result history */}
          <Card>
            <CardHeader title="Approval trail" />
            <CardContent className="text-xs text-slate-500">
              {test.approvedAt ? (
                <>Approved {formatDateTime(test.approvedAt)} by {test.approvedById ?? "—"}</>
              ) : (
                <>Awaiting QA review.</>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {test.attachments && Array.isArray(test.attachments) && (test.attachments as unknown[]).length ? (
        <Card>
          <CardHeader title="Raw data attachments" subtitle="Instrument output files" />
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {(test.attachments as string[]).map((a) => (
              <span key={a} className="rounded-md border border-slate-200 px-2 py-1 font-mono">{a}</span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-sm text-slate-800">{value}</span>
    </div>
  );
}