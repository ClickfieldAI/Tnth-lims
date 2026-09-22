import { Droplet } from "lucide-react";
import { getTestsByType } from "@/lib/testing";
import { TestIndex } from "@/components/testing/test-index";

export const metadata = { title: "Impurity Analysis" };

export default async function ImpurityPage() {
  const rows = await getTestsByType("IMPURITY");
  return (
    <TestIndex
      title="Impurity Analysis"
      description="Related substances, degradation products and unknown impurities against specification limits."
      rows={rows}
      icon={<Droplet className="h-4 w-4" />}
      image="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1000&q=80&auto=format&fit=crop"
    />
  );
}