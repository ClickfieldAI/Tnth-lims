import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FlaskConical, Package, Receipt, FileWarning } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getCustomer, getCustomerHistory } from "@/lib/customers/service";
import { CustomerError, can } from "@/lib/customers/access";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/forms";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { RowActions } from "../status-actions";
import { Tabs } from "./tabs";
import { AddContactForm, AddDocumentForm } from "./contact-doc-forms";

export const metadata = { title: "Customer detail" };

// buttonClass() is client-only (components/ui/button.tsx is "use client");
// this server page just needs the static class string, inlined here.
const SECONDARY_SM_BTN = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 h-8 px-3 text-xs bg-white text-[#1a1d1a] border border-[var(--border-soft)] shadow-[var(--shadow-xs)] hover:bg-brand-50 hover:border-brand-300";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };

  let c;
  try {
    c = await getCustomer(actor, id);
  } catch (e) {
    if (e instanceof CustomerError && e.code === "NOT_FOUND") notFound();
    if (e instanceof CustomerError && e.code === "FORBIDDEN") redirect("/dashboard");
    throw e;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cx = c as any;

  const [samples, products, invoices, history] = await Promise.all([
    prisma.sample.findMany({ where: { clientId: id }, orderBy: { receivedDate: "desc" }, include: { tests: true } }),
    prisma.product.findMany({ where: { clientId: id } }),
    prisma.invoice.findMany({ where: { clientId: id }, orderBy: { issuedAt: "desc" } }),
    can(actor, "history") ? getCustomerHistory(actor, id) : Promise.resolve([]),
  ]);

  const canManage = can(actor, "edit");
  const billing = cx.billing ?? {};
  const reporting = cx.reportingSameAsBilling ? billing : (cx.reporting ?? {});

  const overviewTab = (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Identification & contact" />
        <CardContent className="grid grid-cols-2 gap-4">
          <Row label="Customer type" value={cx.customerType} />
          <Row label="Industry" value={cx.industry} />
          <Row label="Trade name" value={cx.tradeName} />
          <Row label="Website" value={cx.website} />
          <Row label="Primary contact" value={cx.contactPerson} />
          <Row label="Designation" value={cx.designation} />
          <Row label="Email" value={cx.email} />
          <Row label="Phone" value={cx.phone} />
          <Row label="Alternate phone" value={cx.alternatePhone} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Business & tax" />
        <CardContent className="space-y-3">
          <Row label="GST status" value={cx.gstStatus} />
          <Row label="GST number" value={cx.gstNumber} />
          <Row label="PAN number" value={cx.panNumber} />
          <Row label="Billing terms" value={cx.billingTerms} />
          <Row label="PO required" value={cx.poRequired ? "Yes" : "No"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Preferences" />
        <CardContent className="space-y-3">
          <Row label="Preferred communication" value={cx.preferredComm} />
          <Row label="Preferred report delivery" value={cx.preferredDelivery} />
          <Row label="Handling instructions" value={cx.handlingInstructions} />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Notes" />
        <CardContent><p className="text-sm text-slate-700 whitespace-pre-wrap">{cx.notes || "—"}</p></CardContent>
      </Card>
    </div>
  );

  const contactsTab = (
    <div className="space-y-3">
      {canManage ? <AddContactForm customerId={id} /> : null}
      <DataTable>
        <THead><Th>Name</Th><Th>Designation</Th><Th>Email</Th><Th>Phone</Th></THead>
        <TBody>
          {(cx.contacts ?? []).map((ct: { id: string; name: string; designation?: string; email?: string; phone?: string }) => (
            <Tr key={ct.id}><Td className="font-medium">{ct.name}</Td><Td>{ct.designation || "—"}</Td><Td>{ct.email || "—"}</Td><Td>{ct.phone || "—"}</Td></Tr>
          ))}
          {!cx.contacts?.length ? <TableEmpty colSpan={4} message="No additional contacts recorded." /> : null}
        </TBody>
      </DataTable>
    </div>
  );

  const addressesTab = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader title="Billing address" />
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>{billing.line1}</p>
          {billing.line2 ? <p>{billing.line2}</p> : null}
          <p>{[billing.city, billing.district, billing.state, billing.pin].filter(Boolean).join(", ")}</p>
          <p>{billing.country}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Reporting address" subtitle={cx.reportingSameAsBilling ? "Same as billing" : undefined} />
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>{reporting.line1}</p>
          {reporting.line2 ? <p>{reporting.line2}</p> : null}
          <p>{[reporting.city, reporting.district, reporting.state, reporting.pin].filter(Boolean).join(", ")}</p>
          <p>{reporting.country}</p>
        </CardContent>
      </Card>
    </div>
  );

  const documentsTab = (
    <div className="space-y-3">
      {canManage ? <AddDocumentForm customerId={id} /> : null}
      <DataTable>
        <THead><Th>Type</Th><Th>File</Th><Th>Size</Th><Th>Uploaded</Th></THead>
        <TBody>
          {(cx.documents ?? []).map((d: { id: string; docType: string; fileName: string; sizeBytes: number; uploadedAt: Date }) => (
            <Tr key={d.id}>
              <Td><Badge tone="indigo">{d.docType}</Badge></Td>
              <Td className="font-mono text-xs">{d.fileName}</Td>
              <Td className="text-xs">{(d.sizeBytes / 1024).toFixed(0)} KB</Td>
              <Td className="text-xs">{formatDateTime(d.uploadedAt)}</Td>
            </Tr>
          ))}
          {!cx.documents?.length ? <TableEmpty colSpan={4} message="No documents uploaded yet." /> : null}
        </TBody>
      </DataTable>
    </div>
  );

  const enquiriesTab = (
    <EmptyState
      icon={<FileWarning className="h-6 w-6" />}
      title="No enquiries or quotations yet"
      description="Enquiry & Quotation management is not part of this release."
    />
  );

  const samplesTab = (
    <DataTable>
      <THead><Th>Sample</Th><Th>Product</Th><Th>Tests</Th><Th>Received</Th><Th>Status</Th></THead>
      <TBody>
        {samples.map((s) => (
          <Tr key={s.id}>
            <Td><Link href={`/samples/${s.id}`} className="font-medium text-brand-600 hover:underline">{s.sampleCode}</Link></Td>
            <Td>{s.productName ?? "—"}</Td>
            <Td>{s.tests.length}</Td>
            <Td className="text-xs">{formatDate(s.receivedDate)}</Td>
            <Td><StatusBadge status={s.status} dot /></Td>
          </Tr>
        ))}
        {!samples.length ? <TableEmpty colSpan={5} message="No samples submitted yet." /> : null}
      </TBody>
    </DataTable>
  );

  const historyTab = (
    <DataTable>
      <THead><Th>When</Th><Th>Action</Th><Th>By</Th><Th>Old value</Th><Th>New value</Th></THead>
      <TBody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(history as any[]).map((h) => (
          <Tr key={h.id}>
            <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
            <Td><Badge tone="slate">{h.action}</Badge></Td>
            <Td className="text-xs">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</Td>
            <Td className="max-w-[220px] truncate font-mono text-[10px] text-slate-500"><span title={JSON.stringify(h.oldValue)}>{h.oldValue ? JSON.stringify(h.oldValue) : "—"}</span></Td>
            <Td className="max-w-[220px] truncate font-mono text-[10px] text-slate-500"><span title={JSON.stringify(h.newValue)}>{h.newValue ? JSON.stringify(h.newValue) : "—"}</span></Td>
          </Tr>
        ))}
        {!can(actor, "history") ? <TableEmpty colSpan={5} message="You do not have permission to view audit history." /> : null}
        {can(actor, "history") && !history.length ? <TableEmpty colSpan={5} message="No history recorded yet." /> : null}
      </TBody>
    </DataTable>
  );

  const tabs = [
    { key: "overview", label: "Overview", content: overviewTab },
    { key: "contacts", label: "Contacts", content: contactsTab },
    { key: "addresses", label: "Addresses", content: addressesTab },
    { key: "documents", label: "Documents", content: documentsTab },
    { key: "enquiries", label: "Enquiries & Quotations", content: enquiriesTab },
    { key: "samples", label: "Samples & Reports", content: samplesTab },
    { key: "history", label: "Activity & Audit History", content: historyTab },
  ];

  const unpaidTotal = invoices.filter((i) => i.status === "UNPAID").reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-5">
      <Link href="/clients" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Master
      </Link>

      <PageHeader
        title={cx.name}
        description={`${cx.code} · ${cx.customerType} · ${[billing.city, billing.country].filter(Boolean).join(", ")}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={cx.isActive ? "ACTIVE" : "CLOSED"} dot />
            {canManage ? <Link href={`/clients/${id}/edit`} className={SECONDARY_SM_BTN}>Edit</Link> : null}
            <RowActions id={id} isActive={cx.isActive} canManage={canManage} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Samples submitted" value={samples.length} icon={<FlaskConical className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Tests run" value={samples.reduce((a, s) => a + s.tests.length, 0)} tone="blue" />
        <StatCard label="Products registered" value={products.length} icon={<Package className="h-4 w-4" />} tone="violet" />
        <StatCard label="Unpaid balance" value={formatCurrency(unpaidTotal, "INR")} icon={<Receipt className="h-4 w-4" />} tone={unpaidTotal ? "red" : "green"} />
      </div>

      <Card>
        <CardContent>
          <Tabs tabs={tabs} />
        </CardContent>
      </Card>
    </div>
  );
}
