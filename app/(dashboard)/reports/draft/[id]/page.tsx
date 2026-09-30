import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getDraftReport, getReportHistory } from "@/lib/reports/service";
import { DraftReportError, canDraftReport } from "@/lib/reports/access";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { GenerateButton, SubmitForQaButton, ReviseButton, DownloadPdfButton } from "./report-actions";

export const metadata = { title: "Draft Report detail" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function DraftReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any;
  try {
    r = await getDraftReport(actor, id);
  } catch (e) {
    if (e instanceof DraftReportError && e.code === "NOT_FOUND") notFound();
    if (e instanceof DraftReportError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }
  const history = canDraftReport(actor, "history") ? await getReportHistory(actor, id) : [];
  const canEdit = canDraftReport(actor, "edit");

  return (
    <div className="space-y-5">
      <Link href="/reports/draft" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Draft Reports
      </Link>

      <PageHeader
        title={`${r.reportCode} — Rev. ${r.revisionNumber}`}
        description={`${r.customer?.name} · Sample ${r.sampleRegistration?.sampleCode} · TRF ${r.trf?.trfCode}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={r.status} dot />
            {r.status !== "DRAFT" ? <DownloadPdfButton id={id} reportCode={r.reportCode} /> : null}
          </div>
        }
      />

      <Card>
        <CardHeader title="Included results" />
        <DataTable>
          <THead><Th>Test</Th><Th>Result</Th><Th>Analyst</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(r.items as any[]).map((it) => (
              <Tr key={it.id}>
                <Td className="text-xs">{it.testAllocation.trfTestRequest.requestedParameter}</Td>
                <Td className="text-xs">{it.testAllocation.result?.resultValue} {it.testAllocation.result?.unit}</Td>
                <Td className="text-xs">{it.testAllocation.result?.analyst ? `${it.testAllocation.result.analyst.firstName} ${it.testAllocation.result.analyst.lastName}` : "—"}</Td>
              </Tr>
            ))}
            {!r.items.length ? <TableEmpty colSpan={3} message="No results on this report." /> : null}
          </TBody>
        </DataTable>
      </Card>

      {canEdit && r.status === "DRAFT" ? <Card><CardContent><GenerateButton id={id} /></CardContent></Card> : null}
      {canEdit && r.status === "GENERATED" ? <Card><CardContent><SubmitForQaButton id={id} /></CardContent></Card> : null}
      {canEdit && r.status === "SENT_FOR_QA" ? (
        <Card><CardHeader title="Revision" subtitle="Any change once sent for QA review must be a new, auditable revision" /><CardContent><ReviseButton id={id} /></CardContent></Card>
      ) : null}

      {r.qaReview ? (
        <Card>
          <CardHeader title="QA Review" />
          <CardContent className="grid grid-cols-2 gap-4">
            <Row label="Status" value={<Badge tone={r.qaReview.status === "APPROVED" ? "green" : r.qaReview.status === "RETURNED" ? "red" : "amber"}>{r.qaReview.status}</Badge>} />
            <Row label="Reviewer" value={r.qaReview.reviewer ? `${r.qaReview.reviewer.firstName} ${r.qaReview.reviewer.lastName}` : "—"} />
            <Row label="Comments" value={r.qaReview.comments} />
            <Row label="Return reason" value={r.qaReview.returnReason} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="History" />
        <DataTable>
          <THead><Th>When</Th><Th>Action</Th><Th>By</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(history as any[]).map((h) => (
              <Tr key={h.id}><Td className="text-xs">{formatDateTime(h.createdAt)}</Td><Td><Badge tone="slate">{h.action}</Badge></Td><Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td></Tr>
            ))}
            {!history.length ? <TableEmpty colSpan={3} message="No history recorded." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );
}
