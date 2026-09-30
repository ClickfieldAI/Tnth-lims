import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Tag } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSampleRegistrationData, getRegistrationAuditHistory } from "@/lib/registration/service";
import { RegistrationError, canRegistration } from "@/lib/registration/access";
import { findService } from "@/lib/enquiries/catalog";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Tabs } from "../../clients/[id]/tabs";
import { RegisterForm } from "./register-form";
import { PrintLabelButton, DownloadAcknowledgementButton, CancelRegistrationButton, StorageUpdateForm } from "./registered-actions";

export const metadata = { title: "Sample Registration" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm text-slate-800">{value ?? "—"}</p></div>);
}

export default async function SampleRegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any;
  try {
    s = await getSampleRegistrationData(actor, id);
  } catch (e) {
    if (e instanceof RegistrationError && e.code === "NOT_FOUND") notFound();
    if (e instanceof RegistrationError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }

  const registration = s.registration;
  const isRegistered = registration?.registrationStatus === "REGISTERED";
  const isCancelled = registration?.registrationStatus === "CANCELLED";
  const eligible = !!s.receipt && s.technicalReview?.status === "ACCEPTED" && !isRegistered && !isCancelled;
  const canRegister = canRegistration(actor, "register");
  const canCancel = canRegistration(actor, "cancel");
  const canPrint = canRegistration(actor, "print");

  const history = registration && canRegistration(actor, "history") ? await getRegistrationAuditHistory(actor, registration.id) : [];

  const overviewTab = (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Source information (read-only)" action={<Link href={`/trfs/${s.trfId}`} className="text-xs text-brand-600 hover:underline">View TRF</Link>} />
        <CardContent className="grid grid-cols-2 gap-4">
          <Row label="Customer" value={s.trf?.customer?.name} />
          <Row label="TRF Number" value={s.trf?.trfCode} />
          <Row label="Quotation" value={s.trf?.quotation?.quotationCode} />
          <Row label="Product / Sample" value={s.sampleName} />
          <Row label="Batch / Lot" value={s.batchNumber} />
          <Row label="Customer Sample Ref." value={s.customerSampleRef} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Registration" />
        <CardContent className="space-y-3">
          <Row label="Sample ID" value={registration?.sampleCode ?? "Not yet registered"} />
          <Row label="Status" value={<StatusBadge status={registration?.registrationStatus ?? "PENDING_REGISTRATION"} dot />} />
          <Row label="Registered" value={registration?.registeredAt ? formatDateTime(registration.registeredAt) : "—"} />
          <Row label="Registered by" value={registration?.registeredBy ? `${registration.registeredBy.firstName} ${registration.registeredBy.lastName}` : "—"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Receipt information" />
        <CardContent className="grid grid-cols-2 gap-4">
          <Row label="Quantity received" value={s.receipt ? `${s.receipt.receivedQuantity} ${s.receipt.receivedQuantityUnit}` : "—"} />
          <Row label="Container count" value={s.containers} />
          <Row label="Condition" value={s.receipt?.containerCondition} />
          <Row label="Seal status" value={s.receipt?.sealCondition} />
          <Row label="Receipt date/time" value={s.receipt ? formatDateTime(s.receipt.receivedAt) : "—"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Technical review decision" />
        <CardContent>
          <StatusBadge status={s.technicalReview?.status ?? "PENDING"} dot />
        </CardContent>
      </Card>
    </div>
  );

  const testsTab = (
    <DataTable>
      <THead><Th>Service</Th><Th>Requested Parameter</Th><Th>Method</Th></THead>
      <TBody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(s.tests as any[]).map((t) => (
          <Tr key={t.id}>
            <Td>{t.customRequest ? <Badge tone="amber">{t.customServiceName}</Badge> : <Badge tone="indigo">{findService(t.serviceId)?.division ?? t.serviceId}</Badge>}</Td>
            <Td className="text-xs">{t.requestedParameter}</Td>
            <Td className="text-xs">{t.preferredMethod || "—"}</Td>
          </Tr>
        ))}
        {!s.tests.length ? <TableEmpty colSpan={3} message="No tests requested." /> : null}
      </TBody>
    </DataTable>
  );

  const documentsTab = (
    <p className="text-sm text-slate-400">No documents are linked at the sample level yet — see the TRF&apos;s Documents tab for supporting files submitted with this Test Request Form.</p>
  );

  const storageTab = (
    <Card>
      <CardHeader title="Current storage" action={isRegistered && canCancel ? <StorageUpdateForm registrationId={registration.id} trfSampleId={id} storageCondition={registration.storageCondition} storageLocation={registration.storageLocation} /> : undefined} />
      <CardContent className="grid grid-cols-2 gap-4">
        <Row label="Storage condition" value={registration?.storageCondition ?? s.trf?.storageCondition} />
        <Row label="Storage location" value={registration?.storageLocation} />
        <Row label="Remarks" value={registration?.remarks} />
      </CardContent>
    </Card>
  );

  const historyTab = (
    <DataTable>
      <THead><Th>When</Th><Th>Action</Th><Th>By</Th><Th>Details</Th></THead>
      <TBody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(history as any[]).map((h) => (
          <Tr key={h.id}>
            <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
            <Td><Badge tone="slate">{h.action}</Badge></Td>
            <Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td>
            <Td className="max-w-[280px] truncate font-mono text-[10px] text-slate-500"><span title={JSON.stringify(h.newValue)}>{h.newValue ? JSON.stringify(h.newValue) : "—"}</span></Td>
          </Tr>
        ))}
        {!registration ? <TableEmpty colSpan={4} message="Not yet registered — no history." /> : null}
        {registration && !history.length ? <TableEmpty colSpan={4} message="No history recorded." /> : null}
      </TBody>
    </DataTable>
  );

  const tabs = [
    { key: "overview", label: "Overview", content: overviewTab },
    { key: "tests", label: "Tests", content: testsTab },
    { key: "documents", label: "Documents", content: documentsTab },
    { key: "storage", label: "Storage", content: storageTab },
    { key: "history", label: "History", content: historyTab },
  ];

  return (
    <div className="space-y-5">
      <Link href="/sample-registration" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Sample Registration
      </Link>

      <PageHeader
        title={registration?.sampleCode ?? s.sampleName}
        description={`${s.trf?.customer?.name} · TRF ${s.trf?.trfCode}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={registration?.registrationStatus ?? "PENDING_REGISTRATION"} dot />
            {isRegistered && canPrint ? <PrintLabelButton trfSampleId={id} sampleCode={registration.sampleCode} /> : null}
            {isRegistered && canPrint ? <DownloadAcknowledgementButton trfSampleId={id} sampleCode={registration.sampleCode} /> : null}
            {isRegistered && canCancel ? <CancelRegistrationButton registrationId={registration.id} trfSampleId={id} /> : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Registration status" value={registration?.registrationStatus ?? "PENDING_REGISTRATION"} icon={<Tag className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Requested tests" value={s.tests.length} tone="blue" />
        <StatCard label="Technical review" value={s.technicalReview?.status ?? "PENDING"} tone="green" />
      </div>

      {isCancelled ? (
        <Card className="border-rose-300 bg-rose-50">
          <CardContent className="text-sm text-rose-800">
            Registration cancelled {formatDate(registration.cancelledAt)}. Reason: {registration.cancellationReason}. This Sample ID ({registration.sampleCode}) is retired and will never be reused.
          </CardContent>
        </Card>
      ) : null}

      {!isRegistered && !isCancelled ? (
        eligible ? (
          canRegister ? <RegisterForm trfSampleId={id} /> : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You do not have permission to register samples.</div>
          )
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This sample is not yet eligible for registration — receipt must be confirmed and the technical review accepted first.
          </div>
        )
      ) : null}

      <Card><CardContent><Tabs tabs={tabs} /></CardContent></Card>
    </div>
  );
}
