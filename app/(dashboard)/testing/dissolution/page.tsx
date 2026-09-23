import { Timer } from "lucide-react";
import { getTestsByType } from "@/lib/testing";
import { TestIndex } from "@/components/testing/test-index";

export const metadata = { title: "Dissolution" };

export default async function DissolutionPage() {
  const rows = await getTestsByType("DISSOLUTION");
  return (
    <TestIndex
      title="Dissolution Testing"
      description="Drug release profiling per USP <711> with apparatus, medium, RPM and temperature control."
      rows={rows}
      icon={<Timer className="h-4 w-4" />}
      image="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=640&q=65&auto=format&fit=crop"
    />
  );
}