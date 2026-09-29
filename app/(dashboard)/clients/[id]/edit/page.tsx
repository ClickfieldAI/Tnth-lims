import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { can, CustomerError } from "@/lib/customers/access";
import { getCustomer } from "@/lib/customers/service";
import { PageHeader } from "@/components/ui/display";
import { CustomerForm } from "../../customer-form";
import type { CustomerInput } from "@/lib/customers/validation";

export const metadata = { title: "Edit Customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can({ role: user.role }, "edit")) redirect(`/clients/${id}`);

  let c;
  try {
    c = await getCustomer({ id: user.id, role: user.role, clientId: user.clientId }, id);
  } catch (e) {
    if (e instanceof CustomerError && e.code === "NOT_FOUND") notFound();
    redirect("/clients");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c2 = c as any;

  const initial: CustomerInput = {
    customerType: c2.customerType ?? "Company",
    name: c2.name ?? "",
    tradeName: c2.tradeName ?? "",
    industry: c2.industry ?? "",
    active: c2.isActive ?? true,
    contactPerson: c2.contactPerson ?? "",
    designation: c2.designation ?? "",
    email: c2.email ?? "",
    phone: c2.phone ?? "",
    alternatePhone: c2.alternatePhone ?? "",
    website: c2.website ?? "",
    billing: c2.billing ?? { line1: "", line2: "", city: c2.city ?? "", district: "", state: "", pin: "", country: c2.country ?? "India" },
    reportingSameAsBilling: c2.reportingSameAsBilling ?? true,
    reporting: c2.reporting ?? { line1: "", line2: "", city: "", district: "", state: "", pin: "", country: "India", contactPerson: "", email: "", phone: "" },
    gstStatus: c2.gstStatus ?? "Unregistered",
    gstNumber: c2.gstNumber ?? "",
    panNumber: c2.panNumber ?? "",
    billingTerms: c2.billingTerms ?? "",
    poRequired: c2.poRequired ?? false,
    poReference: c2.poReference ?? "",
    taxNotes: c2.taxNotes ?? "",
    preferredComm: c2.preferredComm ?? "Email",
    preferredDelivery: c2.preferredDelivery ?? "Email",
    handlingInstructions: c2.handlingInstructions ?? "",
    testingRequirements: c2.testingRequirements ?? "",
    reportingInstructions: c2.reportingInstructions ?? "",
    notes: c2.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={`/clients/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {c2.name}
      </Link>
      <PageHeader title={`Edit ${c2.name}`} description={c2.code} />
      <CustomerForm mode="edit" customerId={id} initial={initial} />
    </div>
  );
}
