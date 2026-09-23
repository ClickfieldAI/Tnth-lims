import { GitBranch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { NewChangeControlButton, DecideButtons } from "./cc-forms";

export const metadata = { title: "Change Control" };

export default async function ChangeControlPage() {
  const user = await getCurrentUser();
  const canDecide = user?.role === "ADMIN" || user?.role === "QA";

  const ccs = await prisma.changeControl.findMany({
    orderBy: { createdAt: "desc" },
    include: { approvedBy: true },
    take: 100,
  });

  const submitted = ccs.filter((c) => ["SUBMITTED", "IMPACT_REVIEW"].includes(c.status)).length;
  const approved = ccs.filter((c) => c.status === "APPROVED" || c.status === "IMPLEMENTED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality"
        title="Change Control"
        description="Managed changes to methods, processes, equipment and software with impact assessment."
        image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=640&q=65&auto=format&fit=crop"
        actions={<NewChangeControlButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting decision" value={submitted} icon={<GitBranch className="h-4 w-4" />} tone="amber" />
        <StatCard label="Approved / implemented" value={approved} tone="green" />
        <StatCard label="Total requests" value={ccs.length} tone="indigo" />
        <StatCard label="Open change windows" value={ccs.filter((c) => c.status === "IMPLEMENTED").length} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ccs.map((cc) => (
          <Card key={cc.id}>
            <CardHeader
              title={`${cc.ccId} — ${cc.title}`}
              subtitle={cc.description ?? undefined}
              action={<StatusBadge status={cc.status} dot />}
            />
            <div className="space-y-3 px-5 pb-5 text-xs text-slate-500">
              <div className="flex flex-wrap gap-2">
                <Badge tone="slate">{cc.category}</Badge>
                {cc.impactAnalysis && typeof cc.impactAnalysis === "object" ? (
                  <Badge tone={(cc.impactAnalysis as Record<string, unknown>).risk === "high" ? "red" : (cc.impactAnalysis as Record<string, unknown>).risk === "medium" ? "amber" : "green"}>
                    Risk: {String((cc.impactAnalysis as Record<string, unknown>).risk ?? "—")}
                  </Badge>
                ) : null}
              </div>
              <p>Raised by <span className="text-slate-700">{cc.proposedBy ?? "—"}</span> · {formatDateTime(cc.createdAt)}</p>
              {cc.justification ? <p>Justification: <span className="text-slate-700">{cc.justification}</span></p> : null}
              {canDecide && ["SUBMITTED", "IMPACT_REVIEW"].includes(cc.status) ? (
                <div className="border-t border-slate-100 pt-3">
                  <DecideButtons ccId={cc.id} />
                </div>
              ) : cc.approvedBy ? (
                <p className="border-t border-slate-100 pt-3">Decision by {cc.approvedBy.firstName} {cc.approvedBy.lastName}</p>
              ) : null}
            </div>
          </Card>
        ))}
        {!ccs.length ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400 lg:col-span-2">No change control records.</p>
        ) : null}
      </div>
    </div>
  );
}