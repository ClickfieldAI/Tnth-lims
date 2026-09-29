import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/customers/access";
import { PageHeader } from "@/components/ui/display";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Add Customer" };

export default async function NewCustomerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can({ role: user.role }, "create")) redirect("/clients");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/clients" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Master
      </Link>
      <PageHeader title="Add Customer" description="Create a new customer profile with contacts, addresses and business information." />
      <CustomerForm mode="create" />
    </div>
  );
}
