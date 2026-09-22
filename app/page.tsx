import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";
import { HubTopbar } from "@/components/layout/hub-topbar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Lines" };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <HubTopbar
        user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }}
      />
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-8 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            Φ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">TNTH LIMS — Our Services</h1>
            <p className="text-sm text-slate-500">Select an industry to view its testing services.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            return (
              <Link key={ind.slug} href={`/industries/${ind.slug}`}>
                <div className="group flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_8px_24px_rgba(79,70,229,0.12)]">
                  <div className="flex items-start justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500/10 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand-500" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold tracking-tight text-slate-900">{ind.name}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">{ind.tagline}</p>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] font-medium text-brand-600">
                    {ind.subcategories.length} services
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
