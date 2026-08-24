import { Bug } from "lucide-react";
import { getTestsByType } from "@/lib/testing";
import { TestIndex } from "@/components/testing/test-index";

export const metadata = { title: "Microbiology" };

export default async function MicrobiologyPage() {
  const rows = await getTestsByType("MICROBIOLOGY");
  return (
    <TestIndex
      title="Microbiology Testing"
      description="Total bacterial and fungal counts, sterility, endotoxin and microbial limit testing."
      rows={rows}
      icon={<Bug className="h-4 w-4" />}
      resultLabel="Colony count"
    />
  );
}