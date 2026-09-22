import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate, testTypeLabel } from "@/lib/utils";

export const metadata = { title: "QA Review" };

export default async function QaReviewPage() {
  const [testsInReview, reportsPending, recentApprovals] = await Promise.all([
    prisma.test.findMany({
      where: { status: "REVIEW" },
      orderBy: { completedAt: "desc" },
      include: { sample: { include: { client: true } }, assignedTo: true },
    }),
    prisma.testReport.findMany({
      where: { status: { in: ["DRAFT", "UNDER_REVIEW"] } },
      include: { sample: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.approval.findMany({
      orderBy: { at: "desc" },
      take: 8,
      include: { approver: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality"
        title="QA Review Queue"
        description="Documentation review and disposition decisions before release — the quality gate of the laboratory."
        image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1000&q=80&auto=format&fit=crop"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tests awaiting review" value={testsInReview.length} icon={<ClipboardCheck className="h-4 w-4" />} tone="amber" />
        <StatCard label="Reports pending" value={reportsPending.length} tone="violet" />
        <StatCard label="Approved this month" value={recentApprovals.filter((a) => a.action === "APPROVE").length} tone="green" />
        <StatCard label="Decisions logged" value={recentApprovals.length} tone="indigo" />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Tests in review ({testsInReview.length})</h2>
        <DataTable>
          <THead>
            <Th>Request</Th><Th>Sample</Th><Th>Client</Th><Th>Type</Th><Th>Analyst</Th><Th>Result</Th><Th>Status</Th><Th></Th>
          </THead>
          <TBody>
            {testsInReview.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium">{t.requestCode}</Td>
                <Td>{t.sample.sampleCode}</Td>
                <Td>{t.sample.client.name}</Td>
                <Td>{testTypeLabel(t.type)}</Td>
                <Td>{t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "—"}</Td>
                <Td>{t.result ?? "—"} {t.resultStatus ? (
                  <Badge tone={t.resultStatus === "PASS" ? "green" : t.resultStatus === "FAIL" ? "red" : "amber"}>{t.resultStatus}</Badge>
                ) : null}</Td>
                <Td><StatusBadge status={t.status} dot /></Td>
                <Td>
                  <Link href={`/testing/worksheet/${t.id}`} className="text-xs font-medium text-brand-600 hover:underline">Review →</Link>
                </Td>
              </Tr>
            ))}
            {!testsInReview.length ? <TableEmpty colSpan={8} message="Nothing waiting for review — the queue is clear." /> : null}
          </TBody>
        </DataTable>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Reports pending release</h2>
          <DataTable>
            <THead><Th>Report</Th><Th>Title</Th><Th>Created</Th><Th>Status</Th></THead>
            <TBody>
              {reportsPending.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-mono text-[11px]">{r.reportCode}</Td>
                  <Td className="max-w-[200px] truncate">{r.title}</Td>
                  <Td className="text-xs">{formatDate(r.createdAt)}</Td>
                  <Td><StatusBadge status={r.status} dot /></Td>
                </Tr>
              ))}
              {!reportsPending.length ? <TableEmpty colSpan={4} message="No pending reports." /> : null}
            </TBody>
          </DataTable>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent QA decisions</h2>
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {recentApprovals.map((a) => (
              <li key={a.id} className="relative">
                <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white ${a.action === "APPROVE" ? "bg-emerald-500" : a.action === "REJECT" ? "bg-red-500" : "bg-slate-400"}`} />
                <p className="text-xs font-medium capitalize text-slate-800">
                  {a.action.toLowerCase()} · {a.referenceType.toLowerCase()}
                </p>
                <p className="text-[11px] text-slate-500">
                  {a.approver.firstName} {a.approver.lastName} · {formatDate(a.at)}
                </p>
                {a.comment ? <p className="mt-0.5 text-[11px] text-slate-400">{a.comment}</p> : null}
              </li>
            ))}
            {!recentApprovals.length ? <li className="text-xs text-slate-400">No decisions yet.</li> : null}
          </ol>
        </div>
      </div>
    </div>
  );
}