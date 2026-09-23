"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ArrowUpRight, Pill, Apple, Droplets, Sparkles, Leaf, Wheat, Recycle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Industry.icon is a component reference, which can't cross the server/client
// boundary — re-map by slug here instead of passing the icon through props.
const ICONS: Record<string, LucideIcon> = {
  pharmaceuticals: Pill,
  "food-testing": Apple,
  "water-environment": Droplets,
  "personal-care-cosmetics": Sparkles,
  "ayush-testing": Leaf,
  agriculture: Wheat,
  "polymer-testing": Recycle,
};

export interface CatalogIndustry {
  slug: string;
  name: string;
  tagline: string;
  image: string;
  subcategories: { slug: string }[];
}

export function ServiceCatalog({ groups }: { groups: { group: string; industries: CatalogIndustry[] }[] }) {
  const [activeGroup, setActiveGroup] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => activeGroup === "All" || g.group === activeGroup)
      .map((g) => ({
        group: g.group,
        industries: g.industries.filter(
          (ind) => !q || ind.name.toLowerCase().includes(q) || ind.tagline.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.industries.length > 0);
  }, [groups, activeGroup, query]);

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {["All", ...groups.map((g) => g.group)].map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                activeGroup === g
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-[var(--border-soft)] bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-white px-3 text-slate-400 transition-colors focus-within:border-brand-300 sm:w-72">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services..."
            className="w-full bg-transparent text-[13.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 space-y-10">
        {filtered.map(({ group, industries }) => (
          <section key={group}>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{group}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {industries.map((ind) => {
                const Icon = ICONS[ind.slug] ?? Pill;
                return (
                  <Link
                    key={ind.slug}
                    href={`/industries/${ind.slug}`}
                    className="group flex overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white transition-all duration-200 hover:border-brand-200 hover:shadow-[var(--shadow-sm)]"
                  >
                    <div className="flex flex-1 flex-col p-5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <h3 className="mt-3 text-[15px] font-semibold text-[#12151a]">{ind.name}</h3>
                      <p className="mt-1 line-clamp-2 flex-1 text-[13px] leading-relaxed text-slate-500">{ind.tagline}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
                        <span className="text-[12.5px] font-medium text-slate-400">{ind.subcategories.length} services</span>
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600">
                          Open division
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                      </div>
                    </div>
                    <div className="relative hidden w-[38%] shrink-0 sm:block">
                      <Image
                        src={ind.image}
                        alt=""
                        fill
                        sizes="220px"
                        loading="lazy"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {!filtered.length ? (
          <p className="rounded-xl border border-dashed border-[var(--border-soft)] py-12 text-center text-sm text-slate-400">
            No services match your search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
