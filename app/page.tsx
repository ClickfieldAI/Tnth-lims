import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LayoutGrid, FlaskConical, Beaker } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { INDUSTRIES, groupedIndustries, totalServiceCount } from "@/lib/industries";
import { TopNav } from "@/components/layout/topnav";
import { Hero } from "@/components/layout/hero";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Lines" };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  const groups = groupedIndustries();
  const totalServices = totalServiceCount();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav
        role={user.role}
        user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }}
      />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-10 sm:px-8">
        <Hero
          eyebrow="TNTH Services"
          title="Testing service catalog"
          subtitle="Every division the laboratory operates, and the analytical services registered under each. Open a division to register a sample against a specific service."
        />

        <div className="mt-8 grid grid-cols-3 divide-x divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-white">
          <Stat icon={<LayoutGrid className="h-4 w-4" />} label="Service divisions" value={INDUSTRIES.length} />
          <Stat icon={<FlaskConical className="h-4 w-4" />} label="Registered services" value={totalServices} />
          <Stat icon={<Beaker className="h-4 w-4" />} label="Operational test types" value={7} />
        </div>

        <div className="mt-10 space-y-10">
          {groups.map(({ group, industries }) => (
            <section key={group}>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{group}</h2>
              <div className="divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-white">
                {industries.map((ind, i) => {
                  const Icon = ind.icon;
                  return (
                    <Link
                      key={ind.slug}
                      href={`/industries/${ind.slug}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-slate-50/80"
                    >
                      <span className="w-6 shrink-0 text-[13px] font-semibold tabular-nums text-slate-300">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-[#12151a]">{ind.name}</h3>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-slate-500">{ind.tagline}</p>
                      </div>
                      <span className="hidden shrink-0 text-[13px] font-medium text-slate-400 sm:block">
                        {ind.subcategories.length} services
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </Link>
                  );
                })}
              </div>
            </section>
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
