import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canEnquiry } from "@/lib/enquiries/access";
import { PageHeader } from "@/components/ui/display";
import { EnquiryForm, type CustomerOption } from "../enquiry-form";

export const metadata = { title: "New Enquiry" };

export default async function NewEnquiryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEnquiry({ role: user.role }, "create")) redirect("/enquiries");

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

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/enquiries" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Enquiries
      </Link>
      <PageHeader title="New Enquiry" description="Register a customer testing enquiry, requested products and testing services." />
      <EnquiryForm mode="create" customers={customerOptions} managers={managers} />
    </div>
  );
}
