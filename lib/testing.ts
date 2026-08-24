import { prisma } from "@/lib/prisma";
import { asArray } from "@/lib/utils";

export interface TestListRow {
  id: string;
  requestCode: string;
  sampleId: string;
  sampleCode: string;
  product: string;
  batch: string | null;
  client: string;
  analyst: string | null;
  instrument: string | null;
  status: string;
  resultStatus: string | null;
  resultSummary: string;
  spec: string | null;
  completedAt: Date | null;
}

export async function getTestsByType(type: string): Promise<TestListRow[]> {
  const tests = await prisma.test.findMany({
    where: { type },
    orderBy: { createdAt: "desc" },
    include: {
      sample: { include: { client: true } },
      assignedTo: true,
      instrument: true,
      assayResult: true,
      dissolution: true,
      impurityResult: true,
      microbiology: true,
    },
    take: 100,
  });

  return tests.map((t) => {
    let summary = "—";
    let spec: string | null = null;

    if (t.type === "ASSAY" && t.assayResult) {
      const a = t.assayResult;
      spec = `${a.expectedLow ?? "?"}–${a.expectedHigh ?? "?"}%`;
      summary = a.resultPercent != null ? `${a.resultPercent.toFixed(1)}%` : "—";
    } else if (t.type === "DISSOLUTION" && t.dissolution) {
      const pts = Array.isArray(t.dissolution.timepoints)
        ? (t.dissolution.timepoints as { t?: number; p?: number; time?: number; dissolvedPercent?: number }[])
        : [];
      const last = pts[pts.length - 1];
      const pct = last?.p ?? last?.dissolvedPercent;
      spec = "Q = 80% @ 45 min";
      summary = pct != null ? `${pct}% released` : "—";
    } else if (t.type === "IMPURITY" && t.impurityResult) {
      const imp = t.impurityResult;
      spec = imp.specLimit ?? null;
      summary = imp.observedValue != null ? `${imp.observedValue.toFixed(2)}%` : "—";
    } else if (t.type === "MICROBIOLOGY" && t.microbiology) {
      const m = t.microbiology;
      spec = m.limitSpec ?? null;
      summary = m.colonyCount != null ? `${m.colonyCount} CFU` : "—";
    }

    return {
      id: t.id,
      requestCode: t.requestCode,
      sampleId: t.sampleId,
      sampleCode: t.sample.sampleCode,
      product: t.sample.productName ?? "—",
      batch: t.sample.batchNumber,
      client: t.sample.client.name,
      analyst: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : null,
      instrument: t.instrument?.code ?? null,
      status: t.status,
      resultStatus: t.resultStatus,
      resultSummary: summary,
      spec,
      completedAt: t.completedAt,
    };
  });
}

export async function getStabilityOverview() {
  const studies = await prisma.stabilityStudy.findMany({
    orderBy: { startDate: "desc" },
    include: { product: true, batch: true, timepoints: { orderBy: { dueDate: "asc" } } },
  });
  return studies.map((s) => ({
    id: s.id,
    studyId: s.studyId,
    protocol: s.protocol.replace("_", " "),
    product: s.product.name,
    batch: s.batch.batchNumber,
    condition: s.storageCondition,
    intervals: asArray(s.intervals),
    status: s.status,
    progress: s.timepoints.length
      ? Math.round((s.timepoints.filter((t) => t.status === "COMPLETED").length / s.timepoints.length) * 100)
      : 0,
    dueNext: s.timepoints.find((t) => t.status !== "COMPLETED"),
    overdue: s.timepoints.filter((t) => t.dueDate < new Date() && t.status !== "COMPLETED").length,
  }));
}