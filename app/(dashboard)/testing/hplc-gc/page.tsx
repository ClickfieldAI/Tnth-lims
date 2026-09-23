import { Activity } from "lucide-react";
import { getTestsByType } from "@/lib/testing";
import { TestIndex } from "@/components/testing/test-index";

export const metadata = { title: "HPLC / GC Analysis" };

export default async function HplcGcPage() {
  const [hplc, gc] = await Promise.all([getTestsByType("HPLC"), getTestsByType("GC")]);
  return (
    <TestIndex
      title="HPLC / GC Instrument Runs"
      description="Chromatographic sequences, raw data uploads and system suitability for HPLC and GC systems."
      rows={[...hplc, ...gc]}
      icon={<Activity className="h-4 w-4" />}
      resultLabel="Sequence result"
      image="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=640&q=65&auto=format&fit=crop"
    />
  );
}