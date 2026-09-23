import { Ship } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/utils";
import { DispositionActions } from "./disposition-actions";

export const metadata = { title: "Batch Release" };

const STATUS_KEY: Record<string, string> = {
  TESTING: "TESTING", PENDING: "PENDING", RELEASED: "RELEASED", REJECTED: "REJECTED",
};

export default async function BatchReleasePage() {
  const user = await getCurrentUser();
  const canDecide = user?.role === "ADMIN" || user?.role === "QA";
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: true,
      samples: { include: { tests: true } },
      stabilityStudies: true,
    },
    take: 100,
  });

  const pending = batches.filter((b) => b.releaseStatus === "TESTING" || b.releaseStatus === "PENDING");
  const released = batches.filter((b) => b.releaseStatus === "RELEASED");
  const rejected = batches.filter((b) => b.releaseStatus === "REJECTED");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Batch Release Management"
        description="Testing completed → analyst approval → QA review → batch release. Full specification compliance before disposition."
        image="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=640&q=65&auto=format&fit=crop"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting release" value={pending.length} icon={<Ship className="h-4 w-4" />} tone="amber" />
        <StatCard label="Released" value={released.length} tone="green" />
        <StatCard label="Rejected" value={rejected.length} tone="red" />
        <StatCard label="Total batches" value={batches.length} tone="indigo" />
      </div>

      <DataTable>
        <THead>
          <Th>Batch</Th><Th>Product</Th><Th>Mfg date</Th><Th>Expiry</Th><Th>Samples / tests</Th><Th>All approved?</Th><Th>Released</Th><Th>Status</Th>
          {canDecide ? <Th>Disposition</Th> : null}
        </THead>
        <TBody>
          {batches.map((b) => {
            const allTests = b.samples.flatMap((s) => s.tests);
            const approvedTests = allTests.filter((t) => t.status === "APPROVED").length;
            const complete = allTests.length > 0 && approvedTests === allTests.length;
            const decided = b.releaseStatus === "RELEASED" || b.releaseStatus === "REJECTED";
            return (
              <Tr key={b.id}>
                <Td className="font-mono text-[11px] font-semibold">{b.batchNumber}</Td>
                <Td className="max-w-[220px] truncate">{b.product.name}</Td>
                <Td className="text-xs">{formatDate(b.mfgDate)}</Td>
                <Td className="text-xs">{formatDate(b.expDate)}</Td>
                <Td className="text-xs">{b.samples.length} samples · {allTests.length} tests</Td>
                <Td>
                  <StatusBadge status={complete ? "PASS" : allTests.length ? "REVIEW" : "SCHEDULED"} />
                  <span className="ml-1 text-[11px] text-slate-400">
                    {approvedTests}/{allTests.length || 0}
                  </span>
                </Td>
                <Td className="text-xs">{formatDate(b.releasedAt)}</Td>
                <Td><StatusBadge status={STATUS_KEY[b.releaseStatus] ?? b.releaseStatus} dot /></Td>
                {canDecide ? (
                  <Td>
                    {decided ? (
                      <span className="text-[11px] text-slate-400">Signed off</span>
                    ) : (
                      <DispositionActions batchId={b.id} complete={complete} />
                    )}
                  </Td>
                ) : null}
              </Tr>
            );
          })}
          {!batches.length ? <TableEmpty colSpan={canDecide ? 9 : 8} message="No batches registered." /> : null}
        </TBody>
      </DataTable>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Release workflow</p>
        <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          {["Testing completed", "Analyst approval", "QA review", "Batch release approval", "COA issued"].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {released.length ? (
        <p className="text-xs text-slate-400">
          Average quantity released: {formatNumber(released.reduce((a, r) => a + (r.quantity ?? 0), 0) / released.length, 0)} units per batch.
        </p>
      ) : null}
    </div>
  );
}