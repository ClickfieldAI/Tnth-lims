import { BookOpenText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit Trail" };

const ACTION_TONE: Record<string, string> = {
  USER_LOGIN: "slate", USER_LOGOUT: "zinc",
  SAMPLE_CREATED: "blue", SAMPLE_ASSIGNED: "indigo", SAMPLE_STATUS_CHANGED: "indigo",
  RESULT_ENTERED: "amber", TEST_APPROVED: "green", TEST_RETURNED: "red",
  REPORT_APPROVED: "green", DEVIATION_OPENED: "red", DEVIATION_UPDATED: "amber",
  CAPA_CREATED: "violet", CAPA_UPDATED: "violet",
  CHANGE_CONTROL_RAISED: "violet", CHANGE_CONTROL_DECIDED: "violet",
};

export default async function AuditTrailPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { actor: true },
    take: 200,
  });

  const today = logs.filter((l) => l.createdAt.toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail"
        description="Immutable record of every consequential action — who did what, when, and what changed (21 CFR Part 11 aligned)."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events logged" value={logs.length} icon={<BookOpenText className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Today" value={today} tone="blue" />
        <StatCard label="Result changes" value={logs.filter((l) => l.action === "RESULT_ENTERED").length} tone="amber" />
        <StatCard label="Approvals" value={logs.filter((l) => l.action.includes("APPROV")).length} tone="green" />
      </div>

      <DataTable>
        <THead>
          <Th>Timestamp</Th><Th>User</Th><Th>Action</Th><Th>Module</Th><Th>Entity</Th><Th>Change</Th>
        </THead>
        <TBody>
          {logs.map((l) => {
            const change = l.oldValue && l.newValue
              ? `${JSON.stringify(l.oldValue)} → ${JSON.stringify(l.newValue)}`
              : l.newValue ? JSON.stringify(l.newValue) : "—";
            return (
              <Tr key={l.id}>
                <Td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</Td>
                <Td>{l.actor ? `${l.actor.firstName} ${l.actor.lastName}` : "System"}</Td>
                <Td><Badge tone={ACTION_TONE[l.action] ?? "slate"}>{l.action.replace(/_/g, " ").toLowerCase()}</Badge></Td>
                <Td className="text-xs text-slate-500">{l.module}</Td>
                <Td className="text-xs">{l.entityType ?? "—"}</Td>
                <Td className="max-w-[260px] truncate font-mono text-[11px] text-slate-500">{change}</Td>
              </Tr>
            );
          })}
          {!logs.length ? <TableEmpty colSpan={6} message="No audit events yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}