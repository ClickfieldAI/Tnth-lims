import { CalendarClock } from "lucide-react";
import { getStabilityOverview } from "@/lib/testing";
import { PageHeader, StatCard, ProgressBar } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Stability Studies" };

const PROTOCOL_TONE: Record<string, string> = {
  LONG_TERM: "blue", ACCELERATED: "amber", INTERMEDIATE: "violet",
};

export default async function StabilityPage() {
  const studies = await getStabilityOverview();
  const active = studies.filter((s) => s.status === "ACTIVE").length;
  const overdue = studies.reduce((a, s) => a + (s.overdue > 0 ? 1 : 0), 0);
  const dueSoon = studies.filter((s) => s.dueNext && s.dueNext.status === "DUE").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stability Studies"
        description="Long-term, accelerated and intermediate protocols with automated pull scheduling and alerts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active studies" value={active} icon={<CalendarClock className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Due for pull" value={dueSoon} tone="amber" />
        <StatCard label="Overdue timepoints" value={overdue} tone={overdue ? "red" : "green"} />
        <StatCard label="Total studies" value={studies.length} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {studies.map((s) => (
          <Card key={s.id}>
            <CardHeader
              title={`${s.studyId} — ${s.protocol}`}
              subtitle={`${s.product} · Batch ${s.batch}`}
              action={<Badge tone={PROTOCOL_TONE[s.protocol.replace(" ", "_")] ?? "zinc"}>{s.condition}</Badge>}
            />
            <div className="space-y-3 px-5 pb-5">
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Study progress</span>
                  <span>{s.progress}%</span>
                </div>
                <ProgressBar value={s.progress} tone={s.overdue ? "red" : s.progress === 100 ? "emerald" : "indigo"} />
              </div>

              {/* Timeline */}
              <div className="flex items-center gap-1">
                {s.intervals.map((iv, i) => {
                  const done = i < Math.ceil((s.progress / 100) * s.intervals.length);
                  return (
                    <div key={iv} className="flex flex-1 flex-col items-center gap-1">
                      <span className={`h-2 w-full rounded-full ${done ? "bg-indigo-500" : "bg-slate-200"}`} />
                      <span className={`text-[10px] font-medium ${done ? "text-slate-700" : "text-slate-400"}`}>{iv}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-500">
                  {s.dueNext ? (
                    <>Next pull: <span className="font-medium text-slate-700">{s.dueNext.interval}</span> · {formatDate(s.dueNext.dueDate)}</>
                  ) : (
                    <>Study complete</>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.overdue > 0 ? <Badge tone="red">{s.overdue} overdue</Badge> : null}
                  <StatusBadge status={s.status} dot />
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!studies.length ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400 lg:col-span-2">No stability studies registered.</p>
        ) : null}
      </div>
    </div>
  );
}