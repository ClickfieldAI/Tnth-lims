import { prisma } from "@/lib/prisma";

export interface DashboardKpis {
  totalSamples: number;
  underTesting: number;
  completedTests: number;
  pendingApprovals: number;
  failedTests: number;
  stabilityRunning: number;
  batchReleasePending: number;
  avgTurnaroundDays: number;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const [totalSamples, underTesting, completedTests, pendingApprovals, failedTests, stabilityRunning, batchReleasePending] =
    await Promise.all([
      prisma.sample.count(),
      prisma.sample.count({ where: { status: { in: ["TESTING", "ASSIGNED"] } } }),
      prisma.test.count({ where: { status: "APPROVED" } }),
      prisma.test.count({ where: { status: "REVIEW" } }),
      prisma.test.count({ where: { resultStatus: "FAIL" } }),
      prisma.stabilityStudy.count({ where: { status: "ACTIVE" } }),
      prisma.batch.count({ where: { releaseStatus: { in: ["TESTING", "PENDING"] } } }),
    ]);

  const released = await prisma.sample.findMany({
    where: { status: { in: ["APPROVED", "RELEASED"] } },
    select: { receivedDate: true, updatedAt: true },
    take: 200,
  });
  const avgTurnaroundDays = released.length
    ? Math.round(
        released.reduce(
          (acc, r) => acc + Math.max(0, (r.updatedAt.getTime() - r.receivedDate.getTime()) / 86400000),
          0,
        ) / released.length,
      )
    : 0;

  return {
    totalSamples,
    underTesting,
    completedTests,
    pendingApprovals,
    failedTests,
    stabilityRunning,
    batchReleasePending,
    avgTurnaroundDays,
  };
}

export async function getMonthlySampleVolume(months = 6) {
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const samples = await prisma.sample.findMany({
    where: { receivedDate: { gte: start } },
    select: { receivedDate: true },
  });
  const buckets: Record<string, number> = {};
  for (let i = months; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString("en-US", { month: "short" });
    buckets[key] = 0;
  }
  for (const s of samples) {
    const key = s.receivedDate.toLocaleDateString("en-US", { month: "short" });
    if (key in buckets) buckets[key] += 1;
  }
  return Object.entries(buckets).map(([month, count]) => ({ month, samples: count }));
}

export async function getTestTypeDistribution() {
  const grouped = await prisma.test.groupBy({
    by: ["type"],
    _count: { type: true },
  });
  return grouped.map((g) => ({ type: g.type, count: g._count.type }));
}

export async function getPassFailTrend(months = 6) {
  const tests = await prisma.test.findMany({
    where: { resultStatus: { in: ["PASS", "FAIL"] } },
    select: { resultStatus: true, createdAt: true },
  });
  const buckets: Record<string, { pass: number; fail: number }> = {};
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    buckets[d.toLocaleDateString("en-US", { month: "short" })] = { pass: 0, fail: 0 };
  }
  for (const t of tests) {
    const key = t.createdAt.toLocaleDateString("en-US", { month: "short" });
    if (key in buckets) {
      if (t.resultStatus === "PASS") buckets[key].pass += 1;
      else buckets[key].fail += 1;
    }
  }
  return Object.entries(buckets).map(([month, v]) => ({ month, ...v }));
}

export async function getAnalystWorkload() {
  const analysts = await prisma.user.findMany({
    include: { assignedSamples: { select: { id: true } } },
    take: 20,
  });
  return analysts
    .filter((a) => a.roleId && a.firstName)
    .map((a) => ({
      analyst: `${a.firstName} ${a.lastName.charAt(0)}.`,
      samples: a.assignedSamples.length,
    }))
    .filter((x) => x.samples > 0);
}

export async function getInstrumentUtilization() {
  const instruments = await prisma.instrument.findMany({
    include: { tests: { select: { id: true } } },
  });
  return instruments.map((i) => ({
    instrument: i.code,
    tests: i.tests.length,
    category: i.category,
  }));
}