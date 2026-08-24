import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { SampleForm } from "./sample-form";

export const metadata = { title: "Register sample" };

export default async function NewSamplePage() {
  const clients = await prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Sample Registration"
        description="Log a new sample into the laboratory. A unique barcode and chain-of-custody record are generated automatically."
      />
      <Card>
        <CardHeader title="Sample details" subtitle="All fields marked * are required for GMP traceability." />
        <CardContent>
          <SampleForm
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}