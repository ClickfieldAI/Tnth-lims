import Link from "next/link";
import {
  FlaskConical, Beaker, ClipboardCheck, TriangleAlert,
  CalendarClock, Ship, TimerReset, CheckCircle2, ArrowUpRight,
  Inbox, Microscope, ShieldCheck, Stamp, Truck, Archive,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import {
  getDashboardKpis, getMonthlySampleVolume, getTestTypeDistribution,
  getPassFailTrend, getAnalystWorkload, getInstrumentUtilization,
  getFoodTestingPipelineKpis,
} from "@/lib/data";
import { StatCard } from "@/components/ui/display";
import { Hero } from "@/components/layout/hero";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import {
  MonthlyVolumeChart, TestTypePie, PassFailArea,
  WorkloadBar, InstrumentUtilizationChart,
} from "@/components/charts";
import { prisma } from "@/lib/prisma";
import { testTypeLabel, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [kpis, pipeline, volume, types, trend, workload, utilization, recentSamples, upcomingStability] = await Promise.all([
    getDashboardKpis(),
    getFoodTestingPipelineKpis(),
    getMonthlySampleVolume(6),
    getTestTypeDistribution(),
    getPassFailTrend(6),
    getAnalystWorkload(),
    getInstrumentUtilization(),
    prisma.sample.findMany({
      orderBy: { receivedDate: "desc" },
      take: 8,
      include: { client: true },
    }),
    prisma.stabilityTimepoint.findMany({
      where: { status: { in: ["DUE", "SCHEDULED"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { study: { include: { product: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Hero
        eyebrow="Executive Overview"
        title={`Welcome back, ${user?.firstName ?? "Analyst"}`}
        subtitle="Laboratory operations, quality and turnaround performance at a glance."
        image="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=640&q=65&auto=format&fit=crop"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total samples received" value={kpis.totalSamples} icon={<FlaskConical className="h-4 w-4" />} tone="indigo" sub="all time" />
        <StatCard label="Under testing" value={kpis.underTesting} icon={<Beaker className="h-4 w-4" />} tone="amber" sub="active bench work" />
        <StatCard label="Completed tests" value={kpis.completedTests} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" sub="approved results" />
        <StatCard label="Pending approvals" value={kpis.pendingApprovals} icon={<ClipboardCheck className="h-4 w-4" />} tone="violet" sub="awaiting QA review" />
        <StatCard label="Failed tests (OOS)" value={kpis.failedTests} icon={<TriangleAlert className="h-4 w-4" />} tone="red" sub="out of specification" />
        <StatCard label="Stability studies running" value={kpis.stabilityRunning} icon={<CalendarClock className="h-4 w-4" />} tone="blue" sub="active protocols" />
        <StatCard label="Batch release queue" value={kpis.batchReleasePending} icon={<Ship className="h-4 w-4" />} tone="slate" sub="pending disposition" />
        <StatCard label="Avg turnaround time" value={`${kpis.avgTurnaroundDays} d`} icon={<TimerReset className="h-4 w-4" />} tone="indigo" sub="receipt → release" />
      </div>

      <Card>
        <CardHeader title="Food Testing pipeline" subtitle="Live counts across the TRF → Report → Release → Delivery → Retention workflow" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending sample receipt" value={pipeline.pendingReceipt} icon={<Inbox className="h-4 w-4" />} tone="amber" sub="TRFs awaiting receipt" />
          <StatCard label="Tests in progress" value={pipeline.testsInProgress} icon={<Microscope className="h-4 w-4" />} tone="blue" sub="allocated, on the bench" />
          <StatCard label="Pending verification" value={pipeline.pendingVerification} icon={<ShieldCheck className="h-4 w-4" />} tone="violet" sub="results awaiting technical check" />
          <StatCard label="QA pending" value={pipeline.qaPending} icon={<ClipboardCheck className="h-4 w-4" />} tone="violet" sub="reports under QA review" />
          <StatCard label="Awaiting release" value={pipeline.awaitingRelease} icon={<Stamp className="h-4 w-4" />} tone="indigo" sub="QA-approved, not yet released" />
          <StatCard label="Delivered reports" value={pipeline.delivered} icon={<Truck className="h-4 w-4" />} tone="green" sub="sent to customers" />
          <StatCard label="Retention due" value={pipeline.retentionDue} icon={<Archive className="h-4 w-4" />} tone="red" sub="past retention expiry" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly sample volume" subtitle="Samples received per month" />
          <div className="px-3 pb-3"><MonthlyVolumeChart data={volume} /></div>
        </Card>
        <Card>
          <CardHeader title="Test type distribution" subtitle="Share of tests by discipline" />
          <div className="px-3 pb-3">
            <TestTypePie data={types.map((t) => ({ type: testTypeLabel(t.type), count: t.count }))} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pass / fail trend" subtitle="Result outcomes over the last 6 months" />
          <div className="px-3 pb-3"><PassFailArea data={trend} /></div>
        </Card>
        <Card>
          <CardHeader title="Analyst workload" subtitle="Assigned samples per analyst" />
          <div className="px-3 pb-3">
            {workload.length ? <WorkloadBar data={workload} /> : (
              <p className="px-4 py-10 text-center text-xs text-slate-400">No assignments yet.</p>
            )}
          </div>
        </Card>
      </div>

      <RecentActivity recentSamples={recentSamples.map((s) => ({
        id: s.id, code: s.sampleCode, name: s.productName ?? "—",
        client: s.client.name, status: s.status, when: timeAgo(s.receivedDate),
      }))} stability={upcomingStability.map((tp) => ({
        id: tp.id, study: tp.study.studyId, product: tp.study.product.name,
        interval: tp.interval, status: tp.status,
      }))} />

      <InstrumentSection utilization={utilization} />
    </div>
  );
}

function InstrumentSection({ utilization }: { utilization: { instrument: string; tests: number; category: string }[] }) {
  return (
    <Card>
      <CardHeader
        title="Instrument utilisation"
        subtitle="Number of tests executed per analytical system"
        action={
          <Link href="/instruments" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            Manage instruments <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="px-3 pb-3"><InstrumentUtilizationChart data={utilization} /></div>
    </Card>
  );
}
type RecentSample = { id: string; code: string; name: string; client: string; status: string; when: string };
type StabilityTp = { id: string; study: string; product: string; interval: string; status: string };

function RecentActivity({ recentSamples, stability }: { recentSamples: RecentSample[]; stability: StabilityTp[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Recent sample intake"
          subtitle="Latest registrations in the laboratory"
          action={<Link href="/samples" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>}
        />
        <div className="divide-y divide-slate-100">
          {recentSamples.map((s) => (
            <Link key={s.id} href={`/samples/${s.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{s.code}</p>
                <p className="truncate text-xs text-slate-500">{s.name} · {s.client}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-[11px] text-slate-400 sm:block">{s.when}</span>
                <StatusBadge status={s.status} dot />
              </div>
            </Link>
          ))}
          {!recentSamples.length ? (
            <p className="px-5 py-8 text-center text-xs text-slate-400">No samples registered yet.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Upcoming stability pulls" subtitle="Scheduled & due timepoints" />
        <div className="divide-y divide-slate-100">
          {stability.map((tp) => (
            <div key={tp.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-700">{tp.study}</p>
                <p className="truncate text-[11px] text-slate-500">{tp.product} · {tp.interval}</p>
              </div>
              <StatusBadge status={tp.status} />
            </div>
          ))}
          {!stability.length ? (
            <p className="px-5 py-8 text-center text-xs text-slate-400">No scheduled timepoints.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}