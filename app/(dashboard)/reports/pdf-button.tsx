"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReportPdfData } from "@/actions/reports";

export function PdfExportButton({ sampleId, reportCode }: { sampleId: string; reportCode: string }) {
  const [loading, setLoading] = useState(false);

  async function exportPdf() {
    setLoading(true);
    try {
      const data = await getReportPdfData(sampleId);
      if (!data) return;
      const { generateTnthReportPdf } = await import("@/lib/tnth-pdf");
      const doc = generateTnthReportPdf(data);
      doc.save(`${reportCode}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={exportPdf} disabled={loading} title="Download PDF">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
    </Button>
  );
}
