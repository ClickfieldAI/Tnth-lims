import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canEnquiry, EnquiryError } from "@/lib/enquiries/access";
import { getEnquiry } from "@/lib/enquiries/service";
import { PageHeader } from "@/components/ui/display";
import { EnquiryForm, type CustomerOption } from "../../enquiry-form";
import type { EnquiryInput } from "@/lib/enquiries/validation";

export const metadata = { title: "Edit Enquiry" };

export default async function EditEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };
  if (!canEnquiry(actor, "edit")) redirect(`/enquiries/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let e: any;
  try {
    e = await getEnquiry(actor, id);
  } catch (err) {
    if (err instanceof EnquiryError && err.code === "NOT_FOUND") notFound();
    redirect("/enquiries");
  }
  if (["ACCEPTED", "REJECTED", "CLOSED"].includes(e.status)) redirect(`/enquiries/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customers, users] = await Promise.all([
    prisma.client.findMany({}) as unknown as Promise<any[]>,
    prisma.user.findMany({ include: { role: true } as any }) as unknown as Promise<any[]>,
  ]);
  const customerOptions: CustomerOption[] = customers.map((c) => ({
    id: c.id, code: c.code, name: c.name, contactPerson: c.contactPerson ?? "", email: c.email ?? "", phone: c.phone ?? "",
    isActive: c.isActive, billing: c.billing,
  }));
  const managers = users.filter((u) => ["ADMIN", "MANAGER"].includes(u.role.name) && u.isActive).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));

  const initial: EnquiryInput = {
    customerId: e.customerId, enquiryDate: new Date(e.enquiryDate).toISOString().slice(0, 10),
    enquirySource: e.enquirySource, assignedManagerId: e.assignedManagerId, priority: e.priority,
    requestedTurnaroundDays: e.requestedTurnaroundDays, purposeOfTesting: e.purposeOfTesting,
    regulatoryRequirements: e.regulatoryRequirements, requiredReportingFormat: e.requiredReportingFormat,
    requiredAccreditation: e.requiredAccreditation, reportDeliveryMethod: e.reportDeliveryMethod, customerNotes: e.customerNotes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: (e.products as any[]).map((p) => ({
      productName: p.productName, productCategory: p.productCategory, productDescription: p.productDescription,
      batchNumber: p.batchNumber, sampleType: p.sampleType, sampleMatrix: p.sampleMatrix, quantity: p.quantity ?? undefined,
      quantityUnit: p.quantityUnit, packagingDetails: p.packagingDetails, storageRequirements: p.storageRequirements,
      specialHandlingInstructions: p.specialHandlingInstructions,
      requestedTestingDate: p.requestedTestingDate ? new Date(p.requestedTestingDate).toISOString().slice(0, 10) : undefined,
      notes: p.notes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tests: (p.tests as any[]).map((t) => ({
        serviceId: t.serviceId ?? "", customRequest: t.customRequest, customServiceName: t.customServiceName,
        requestedTest: t.requestedTest, requestedMethod: t.requestedMethod, specification: t.specification,
        requestedQuantity: t.requestedQuantity, specialRequirements: t.specialRequirements, estimatedTurnaroundDays: t.estimatedTurnaroundDays,
      })),
    })),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={`/enquiries/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {e.enquiryCode}
      </Link>
      <PageHeader title={`Edit ${e.enquiryCode}`} description={e.customer?.name} />
      <EnquiryForm mode="edit" enquiryId={id} initial={initial} customers={customerOptions} managers={managers} />
    </div>
  );
}
