import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowUpRight, FlaskConical, Beaker } from "lucide-react";
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
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-8 sm:px-8">
        <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-slate-500">
          <Link href="/" className="hover:text-slate-800">TNTH LIMS</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/" className="hover:text-slate-800">Services</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="font-medium text-slate-700">{industry.name}</span>
        </nav>

        <Hero
          eyebrow={industry.group}
          title={industry.name}
          subtitle={industry.tagline}
          image={industry.image}
        />

        <div className="mt-6 grid grid-cols-2 divide-x divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-white sm:grid-cols-2">
          <Stat icon={<FlaskConical className="h-4 w-4" />} label="Testing areas" value={industry.subcategories.length} />
          <Stat icon={<Beaker className="h-4 w-4" />} label="Methods & techniques" value={totalMethods} />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#12151a]">{industry.name}</h2>
          <Link
            href={`/samples/new?industry=${industry.slug}`}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
          >
            + Register sample
          </Link>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {industry.subcategories.map((sub) => (
            <Link
              key={sub.slug}
              href={`/industries/${industry.slug}/${sub.slug}`}
              className="group flex flex-col rounded-xl border border-[var(--border-soft)] bg-white p-5 transition-all duration-200 hover:border-brand-200 hover:shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-[#12151a]">{sub.name}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-600" />
              </div>
              <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] leading-relaxed text-slate-500">{sub.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-soft)] pt-3">
                {sub.techniques.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{t}</span>
                ))}
                {sub.techniques.length > 3 ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    +{sub.techniques.length - 3}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <div>
        <p className="text-lg font-bold leading-none text-[#12151a]">{value}</p>
        <p className="mt-1 text-[12px] font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}
