import { Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, ProgressBar } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NewCapaButton } from "./new-capa";
import { CapaActions } from "./capa-actions";

export const metadata = { title: "CAPA" };

export default async function CapaPage() {
  const [capas, ownerRows] = await Promise.all([
    prisma.capa.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: true, relatedDeviation: true },
      take: 100,
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { name: { in: ["ANALYST", "MICRO", "QA", "MANAGER"] } } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  const owners = ownerRows.map((o) => ({ id: o.id, name: `${o.firstName} ${o.lastName}` }));

  const open = capas.filter((c) => c.status === "OPEN").length;
  const inProgress = capas.filter((c) => c.status === "IN_PROGRESS").length;
  const overdue = capas.filter((c) => c.dueDate && c.dueDate < new Date() && c.status !== "CLOSED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality"
        title="CAPA — Corrective & Preventive Actions"
        description="Actions arising from deviations, audits and risk assessments with owner accountability and due dates."
        image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=640&q=65&auto=format&fit=crop"
        actions={<NewCapaButton owners={owners} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open CAPAs" value={open} icon={<Wrench className="h-4 w-4" />} tone="amber" />
        <StatCard label="In progress" value={inProgress} tone="blue" />
        <StatCard label="Overdue" value={overdue} tone={overdue ? "red" : "green"} />
        <StatCard label="Total" value={capas.length} tone="indigo" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {capas.map((c) => {
          const daysLeft = c.dueDate ? Math.ceil((c.dueDate.getTime() - Date.now()) / 86400000) : null;
          const progress = c.status === "CLOSED" || c.status === "VERIFIED" ? 100
            : c.status === "IN_PROGRESS" ? 55
            : c.status === "COMPLETE" ? 85 : 15;
          return (
            <Card key={c.id}>
              <CardHeader
                title={`${c.capaId} — ${c.title}`}
                subtitle={c.description ?? undefined}
                action={
                  <div className="flex items-center gap-2">
                    <Badge tone={c.type === "CORRECTIVE" ? "amber" : "blue"}>{c.type}</Badge>
                    <StatusBadge status={c.status} dot />
                  </div>
                }
              />
              <div className="space-y-3 px-5 pb-5">
                <ProgressBar value={progress} tone={overdue && progress < 100 ? "red" : progress === 100 ? "emerald" : "indigo"} />
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <p>Owner: <span className="font-medium text-slate-700">{c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : "Unassigned"}</span></p>
                  <p>Due: <span className={`font-medium ${daysLeft !== null && daysLeft < 0 && progress < 100 ? "text-red-600" : "text-slate-700"}`}>
                    {formatDate(c.dueDate)}
                  </span></p>
                  {c.action ? (
                    <p className="col-span-2">Action: <span className="text-slate-700">{c.action}</span></p>
                  ) : null}
                  {c.relatedDeviation ? (
                    <p className="col-span-2">Linked deviation: <span className="font-mono text-[11px] text-brand-600">{c.relatedDeviation.deviationId}</span></p>
                  ) : null}
                </div>
                <CapaActions capaId={c.id} status={c.status} />
              </div>
            </Card>
          );
        })}
        {!capas.length ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400 lg:col-span-2">No CAPAs recorded.</p>
        ) : null}
      </div>
    </div>
  );
}