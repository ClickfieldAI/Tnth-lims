import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getWorksheet, getWorksheetHistory } from "@/lib/worksheets/service";
import { WorksheetError, canWorksheet } from "@/lib/worksheets/access";
import { findService } from "@/lib/enquiries/catalog";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PrepareButton, AssignButton, RemoveTestButton } from "./worksheet-actions";

export const metadata = { title: "Worksheet detail" };

export default async function WorksheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let w: any;
  try {
    w = await getWorksheet(actor, id);
  } catch (e) {
    if (e instanceof WorksheetError && e.code === "NOT_FOUND") notFound();
    if (e instanceof WorksheetError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }
  const history = canWorksheet(actor, "history") ? await getWorksheetHistory(actor, id) : [];
  const canEdit = canWorksheet(actor, "edit") && w.status === "DRAFT";

  return (
    <div className="space-y-5">
      <Link href="/worksheets" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Worksheets
      </Link>

      <PageHeader
        title={w.worksheetCode}
        description={`Analyst: ${w.analyst ? `${w.analyst.firstName} ${w.analyst.lastName}` : "—"}`}
        actions={<StatusBadge status={w.status} dot />}
      />

      <Card>
        <CardHeader title="Worksheet items" />
        <DataTable>
          <THead><Th>Sample ID</Th><Th>TRF</Th><Th>Customer</Th><Th>Product</Th><Th>Test</Th><Th>Method</Th><Th>Priority</Th><Th>Due Date</Th>{canEdit ? <Th>Actions</Th> : null}</THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(w.items as any[]).map((it) => {
              const tr = it.testAllocation.trfTestRequest;
              const reg = tr.sample.registration;
              return (
                <Tr key={it.id}>
                  <Td className="font-mono text-[11px]">{reg?.sampleCode ?? "—"}</Td>
                  <Td className="text-xs">{tr.sample.trf?.trfCode}</Td>
                  <Td className="text-xs">{tr.sample.trf?.customer?.name}</Td>
                  <Td className="text-xs">{tr.sample.sampleName}</Td>
                  <Td>{tr.customRequest ? <Badge tone="amber">{tr.customServiceName}</Badge> : <Badge tone="indigo">{findService(tr.serviceId)?.division ?? tr.serviceId}</Badge>} <span className="text-xs">{tr.requestedParameter}</span></Td>
                  <Td className="text-xs">{tr.preferredMethod || "—"}</Td>
                  <Td className="text-xs">{it.testAllocation.priority}</Td>
                  <Td className="text-xs">{formatDate(it.testAllocation.dueDate)}</Td>
                  {canEdit ? <Td><RemoveTestButton worksheetId={id} testAllocationId={it.testAllocationId} /></Td> : null}
                </Tr>
              );
            })}
            {!w.items.length ? <TableEmpty colSpan={canEdit ? 9 : 8} message="No tests on this worksheet." /> : null}
          </TBody>
        </DataTable>
      </Card>

      {w.notes ? <Card><CardHeader title="Preparation instructions / notes" /><CardContent className="text-sm text-slate-700">{w.notes}</CardContent></Card> : null}

      {canWorksheet(actor, "edit") && w.status === "DRAFT" ? <Card><CardContent><PrepareButton id={id} /></CardContent></Card> : null}
      {canWorksheet(actor, "assign") && w.status === "PREPARED" ? <Card><CardContent><AssignButton id={id} /></CardContent></Card> : null}

      <Card>
        <CardHeader title="History" />
        <DataTable>
          <THead><Th>When</Th><Th>Action</Th><Th>By</Th></THead>
          <TBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(history as any[]).map((h) => (
              <Tr key={h.id}><Td className="text-xs">{formatDateTime(h.createdAt)}</Td><Td><Badge tone="slate">{h.action}</Badge></Td><Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td></Tr>
            ))}
            {!history.length ? <TableEmpty colSpan={3} message="No history recorded." /> : null}
          </TBody>
        </DataTable>
      </Card>
    </div>
  );
}
