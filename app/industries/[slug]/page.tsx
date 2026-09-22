import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav role={user.role} user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }} />
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-6 py-8 sm:px-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> All services
        </Link>

        <Hero eyebrow="Service Division" title={industry.name} subtitle={industry.tagline} image={industry.image} className="mb-8" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {industry.subcategories.map((sub) => (
            <Link key={sub.slug} href={`/industries/${industry.slug}/${sub.slug}`}>
              <div className="group flex h-full flex-col rounded-xl border border-[var(--border-soft)] bg-white p-5 shadow-[var(--shadow-xs)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-[#1a1d1a]">{sub.name}</h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-500" />
                </div>
                <p className="mt-2 flex-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{sub.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--border-soft)] pt-3">
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
