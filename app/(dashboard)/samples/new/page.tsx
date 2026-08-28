import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getSubcategory } from "@/lib/industries";
import { SampleForm } from "./sample-form";

export const metadata = { title: "Register sample" };

export default async function NewSamplePage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; sub?: string }>;
}) {
  const { industry: industrySlug, sub: subSlug } = await searchParams;
  const found = industrySlug && subSlug ? getSubcategory(industrySlug, subSlug) : null;

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      ...(found ? { industry: found.industry.clientIndustry } : {}),
    },
    orderBy: { name: "asc" },
  });
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Sample Registration"
        description={
          found
            ? `Register a sample for ${found.sub.name} — ${found.industry.name}. A unique barcode and chain-of-custody record are generated automatically.`
            : "Log a new sample into the laboratory. A unique barcode and chain-of-custody record are generated automatically."
        }
      />
      <Card>
        <CardHeader title="Sample details" subtitle="All fields marked * are required for GMP traceability." />
        <CardContent>
          <SampleForm
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            lockedTest={found ? { code: found.sub.slug, label: found.sub.name } : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
