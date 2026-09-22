import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getIndustry } from "@/lib/industries";
import { TopNav } from "@/components/layout/topnav";
import { Hero } from "@/components/layout/hero";

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

  const totalMethods = new Set(industry.subcategories.flatMap((s) => s.techniques)).size;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav role={user.role} user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }} />
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-6 py-10 sm:px-8">
        <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-slate-500">
          <Link href="/" className="hover:text-slate-800">All Services</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="font-medium text-slate-700">{industry.name}</span>
        </nav>

        <Hero
          eyebrow={industry.group}
          title={industry.name}
          subtitle={industry.tagline}
          meta={
            <>
              <span>{industry.subcategories.length} testing areas</span>
              <span className="text-slate-300">•</span>
              <span>{totalMethods} methods</span>
            </>
          }
          image={industry.image}
          actions={
            <Link
              href={`/samples/new?industry=${industry.slug}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
            >
              Register sample
            </Link>
          }
        />

        <div className="mt-8 divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-white">
          {industry.subcategories.map((sub, i) => (
            <Link
              key={sub.slug}
              href={`/industries/${industry.slug}/${sub.slug}`}
              className="group block px-6 py-5 transition-colors duration-150 hover:bg-slate-50/80"
            >
              <div className="flex items-start gap-4">
                <span className="w-6 shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-slate-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[15px] font-semibold text-[#12151a]">{sub.name}</h3>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-600" />
                  </div>
                  <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">{sub.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {sub.techniques.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{t}</span>
                    ))}
                    {sub.techniques.length > 3 ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        +{sub.techniques.length - 3} methods
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
