import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { groupedIndustries } from "@/lib/industries";
import { TopNav } from "@/components/layout/topnav";
import { Hero } from "@/components/layout/hero";
import { ServiceCatalog } from "@/components/services/service-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Lines" };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  const groups = groupedIndustries().map((g) => ({
    group: g.group,
    industries: g.industries.map((ind) => ({
      slug: ind.slug,
      name: ind.name,
      tagline: ind.tagline,
      image: ind.image,
      subcategories: ind.subcategories.map((s) => ({ slug: s.slug })),
    })),
  }));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav
        role={user.role}
        user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }}
      />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-8 sm:px-8">
        <Hero
          eyebrow="TNTH Services"
          title="What can we test for you?"
          subtitle="Select a laboratory service division to view its testing capabilities and register a sample."
          image="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=640&q=65&auto=format&fit=crop"
        />

        <ServiceCatalog groups={groups} />
      </main>
    </div>
  );
}
