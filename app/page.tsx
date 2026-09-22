import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";
import { TopNav } from "@/components/layout/topnav";
import { Hero } from "@/components/layout/hero";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Lines" };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav
        role={user.role}
        user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }}
      />
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-6 py-8 sm:px-8">
        <Hero
          eyebrow="TNTH Services"
          title="What can we test for you?"
          subtitle="Select a laboratory service line to view its testing capabilities and register a sample."
          image="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1200&q=80&auto=format&fit=crop"
          className="mb-8"
        />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            return (
              <Link key={ind.slug} href={`/industries/${ind.slug}`}>
                <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white shadow-[var(--shadow-xs)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
                  <div className="relative h-32 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ind.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                    <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-brand-600 shadow-sm backdrop-blur">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight text-[#1a1d1a]">{ind.name}</h3>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-500" />
                    </div>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">{ind.tagline}</p>
                    <div className="mt-4 border-t border-[var(--border-soft)] pt-3 text-[11px] font-semibold text-brand-600">
                      {ind.subcategories.length} services · Open division
                    </div>
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
