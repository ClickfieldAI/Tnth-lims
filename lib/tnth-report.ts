import { prisma } from "@/lib/prisma";
import { testTypeLabel } from "@/lib/utils";

// The TNTH template uses DD.MM.YYYY (e.g. "17.08.2026"), distinct from the
// app's global date format — kept local to this report generator.
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

// Data shape consumed by generateTnthReportPdf() (lib/tnth-pdf.ts). This is a
// presentation-layer aggregation only — it reads existing Sample/Test/typed-
// result rows and reshapes them into the section/row structure the TNTH
// controlled report template requires. No schema or workflow changes.
export interface TnthReportRow {
  sNo: string;
  parameter: string;
  method: string;
  unit: string;
  result: string;
  limit: string;
}

export interface TnthReportSection {
  heading: string; // e.g. "I) Nutritional Labelling"
  rows: TnthReportRow[];
}

export interface TnthReportData {
  reportNo: string;
  date: string;
  customerName: string;
  address: string;
  sampleDescription: string;
  batchNo: string;
  sampleQuantity: string;
  packingCondition: string;
  sampleReceivedOn: string;
  analysisStartedOn: string;
  analysisCompletedOn: string;
  sections: TnthReportSection[];
  verifiedBy: string;
  authorisedSignatory: string;
}

const UNIT_BY_TYPE: Record<string, string> = {
  ASSAY: "%",
  DISSOLUTION: "%",
  IMPURITY: "%",
  HPLC: "—",
  GC: "—",
  MICROBIOLOGY: "CFU/g",
  STABILITY: "—",
};

function resultAndLimitFor(test: {
  type: string;
  result: string | null;
  assayResult: { resultPercent: number | null; expectedLow: number | null; expectedHigh: number | null } | null;
  dissolution: { pass: boolean | null } | null;
  impurityResult: { observedValue: number | null; specLimit: string | null; specMax: number | null } | null;
  microbiology: { colonyCount: number | null; limitSpec: string | null } | null;
}): { result: string; limit: string; unit: string } {
  if (test.type === "ASSAY" && test.assayResult) {
    const a = test.assayResult;
    return {
      result: a.resultPercent != null ? a.resultPercent.toFixed(2) : "—",
      limit: a.expectedLow != null && a.expectedHigh != null ? `${a.expectedLow}–${a.expectedHigh}%` : "—",
      unit: "%",
    };
  }
  if (test.type === "IMPURITY" && test.impurityResult) {
    const imp = test.impurityResult;
    return {
      result: imp.observedValue != null ? imp.observedValue.toFixed(2) : "—",
      limit: imp.specLimit ?? (imp.specMax != null ? `NMT ${imp.specMax}` : "—"),
      unit: "%",
    };
  }
  if (test.type === "MICROBIOLOGY" && test.microbiology) {
    const m = test.microbiology;
    return {
      result: m.colonyCount != null ? String(m.colonyCount) : (test.result ?? "—"),
      limit: m.limitSpec ?? "—",
      unit: "CFU/g",
    };
  }
  if (test.type === "DISSOLUTION" && test.dissolution) {
    return { result: test.result ?? "—", limit: test.dissolution.pass === null ? "—" : "Q = 80%", unit: "%" };
  }
  return { result: test.result ?? "—", limit: "—", unit: UNIT_BY_TYPE[test.type] ?? "—" };
}

function toRoman(n: number): string {
  const numerals: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  let num = n;
  for (const [value, symbol] of numerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

export async function getTnthReportData(sampleId: string): Promise<TnthReportData | null> {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    include: {
      client: true,
      tests: {
        orderBy: { createdAt: "asc" },
        include: { assayResult: true, dissolution: true, impurityResult: true, microbiology: true },
      },
      invoice: false,
    },
  });
  if (!sample) return null;

  const byType = new Map<string, typeof sample.tests>();
  for (const t of sample.tests) {
    if (!byType.has(t.type)) byType.set(t.type, []);
    byType.get(t.type)!.push(t);
  }

  const sections: TnthReportSection[] = Array.from(byType.entries()).map(([type, tests], idx) => ({
    heading: `${toRoman(idx + 1)}) ${testTypeLabel(type)}`,
    rows: tests.map((t, i) => {
      const { result, limit, unit } = resultAndLimitFor(t);
      return {
        sNo: String(i + 1),
        parameter: t.testName,
        method: t.method ?? "—",
        unit,
        result,
        limit,
      };
    }),
  }));

  return {
    reportNo: `TNTH/${sample.sampleCode}/${new Date(sample.receivedDate).getFullYear()}-${String(new Date(sample.receivedDate).getFullYear() + 1).slice(-2)}`,
    date: formatDate(new Date()),
    customerName: `M/s. ${sample.client.name}`,
    address: [sample.client.address, sample.client.city, sample.client.country].filter(Boolean).join(", ") || "—",
    sampleDescription: sample.productName ?? sample.sampleCode,
    batchNo: sample.batchNumber ?? "NA",
    sampleQuantity: sample.quantity != null ? `${sample.quantity} ${sample.unit ?? ""}`.trim() : "—",
    packingCondition: "In Packed Condition",
    sampleReceivedOn: formatDate(sample.receivedDate),
    analysisStartedOn: formatDate(sample.tests[0]?.startedAt ?? sample.receivedDate),
    analysisCompletedOn: formatDate(sample.tests.find((t) => t.completedAt)?.completedAt ?? null),
    sections,
    verifiedBy: "Verified By",
    authorisedSignatory: "Authorised Signatory",
  };
}
