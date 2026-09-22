import Link from "next/link";
import { PageHeader } from "@/components/ui/display";
import { Card } from "@/components/ui/card";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/display";
import type { TestListRow } from "@/lib/testing";

export function TestIndex({
  title,
  description,
  rows,
  resultLabel,
  specLabel,
  icon,
}: {
  title: string;
  description: string;
  rows: TestListRow[];
  resultLabel?: string;
  specLabel?: string;
  icon?: React.ReactNode;
}) {
  const pass = rows.filter((r) => r.resultStatus === "PASS").length;
  const fail = rows.filter((r) => r.resultStatus === "FAIL").length;
  const inProgress = rows.filter((r) => ["TESTING", "REVIEW", "ASSIGNED"].includes(r.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tests" value={rows.length} icon={icon} tone="indigo" />
        <StatCard label="Pass" value={pass} tone="green" />
        <StatCard label="Fail / OOS" value={fail} tone="red" />
        <StatCard label="In progress" value={inProgress} tone="amber" />
      </div>

      <Card>
        <DataTable>
          <THead>
            <Th>Request</Th>
            <Th>Sample</Th>
            <Th>Product</Th>
            <Th>Analyst</Th>
            <Th>Instrument</Th>
            <Th>{specLabel ?? "Specification"}</Th>
            <Th>{resultLabel ?? "Result"}</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td><Link href={`/testing/worksheet/${r.id}`} className="font-medium text-brand-600 hover:underline">{r.requestCode}</Link></Td>
                <Td><Link href={`/samples/${r.sampleId}`} className="hover:underline">{r.sampleCode}</Link></Td>
                <Td className="max-w-[200px] truncate">{r.product}</Td>
                <Td>{r.analyst ?? "—"}</Td>
                <Td>{r.instrument ?? "—"}</Td>
                <Td className="text-xs text-slate-500">{r.spec ?? "—"}</Td>
                <Td>
                  {r.resultStatus ? (
                    <span className={`font-semibold ${r.resultStatus === "PASS" ? "text-emerald-600" : r.resultStatus === "FAIL" ? "text-red-600" : "text-amber-600"}`}>
                      {r.resultSummary}
                    </span>
                  ) : (
                    <Badge tone="zinc">Pending</Badge>
                  )}
                </Td>
                <Td><StatusBadge status={r.status} dot /></Td>
              </Tr>
            ))}
            {!rows.length ? <TableEmpty colSpan={8} message="No tests recorded for this discipline yet." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );
}