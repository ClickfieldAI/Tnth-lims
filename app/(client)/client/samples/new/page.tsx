import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ClientSampleForm } from "./form";

export const metadata = { title: "Submit a sample" };

export default async function ClientNewSamplePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Submit a Sample"
        description="Provide the product details and the tests you require. The laboratory confirms receipt and logs your sample into the GMP workflow."
      />
      <Card>
        <CardHeader title="Submission form" subtitle="Fields marked * are required." />
        <CardContent><ClientSampleForm /></CardContent>
      </Card>
    </div>
  );
}