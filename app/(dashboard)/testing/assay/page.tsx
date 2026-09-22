import { Beaker } from "lucide-react";
import { getTestsByType } from "@/lib/testing";
import { TestIndex } from "@/components/testing/test-index";

export const metadata = { title: "Drug Assay" };

export default async function AssayPage() {
  const rows = await getTestsByType("ASSAY");
  return (
    <TestIndex
      title="Drug Assay Testing"
      description="Quantitative determination of active pharmaceutical ingredient against label claim (USP <791>)."
      rows={rows}
      icon={<Beaker className="h-4 w-4" />}
      image="https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=1000&q=80&auto=format&fit=crop"
    />
  );
}