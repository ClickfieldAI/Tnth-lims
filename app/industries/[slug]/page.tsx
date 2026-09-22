import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getIndustry } from "@/lib/industries";
import { HubTopbar } from "@/components/layout/hub-topbar";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  return { title: industry ? industry.name : "Industry" };
}

export default async function IndustrySubcategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  const industry = getIndustry(slug);
  if (!industry) notFound();
  const Icon = industry.icon;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <HubTopbar user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }} />
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-8 py-10">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> All industries
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{industry.name}</h1>
            <p className="text-sm text-slate-500">{industry.tagline}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {industry.subcategories.map((sub) => (
            <Link key={sub.slug} href={`/industries/${industry.slug}/${sub.slug}`}>
              <div className="group flex h-full flex-col rounded-md border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_8px_24px_rgba(79,70,229,0.12)]">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-slate-900">{sub.name}</h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-500" />
                </div>
                <p className="mt-2 flex-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{sub.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                  {sub.techniques.slice(0, 2).map((t) => (
                    <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700">{t}</span>
                  ))}
                  {sub.techniques.length > 2 ? (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">+{sub.techniques.length - 2} more</span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
