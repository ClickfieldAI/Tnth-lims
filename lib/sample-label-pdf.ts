import jsPDF from "jspdf";
import { TNTH_LOGO_BASE64 } from "./tnth-logo";

// Compact printable sample label — sized for a physical sample container
// (100mm x 50mm), not a full A4 page. Same official TNTH branding as the
// other generated documents in this app.

export interface SampleLabelData {
  sampleCode: string;
  productName: string;
  batchNumber?: string;
  customerSampleRef?: string;
  receivedDate: string;
  storageCondition: string;
  handlingWarning?: string;
  barcodeDataUrl: string;
}

function clean(text: string): string {
  return (text || "").replace(/µ/g, "u").replace(/±/g, "+/-").replace(/°/g, "deg ");
}

export function generateSampleLabelPdf(data: SampleLabelData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: [100, 50] });
  const W = 100;
  const M = 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(1, 1, W - 2, 48);

  doc.addImage(TNTH_LOGO_BASE64, "PNG", M, 3, 10, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(7, 120, 60);
  doc.text("TNTH LIMS", M + 12, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  doc.text("Tamilnadu Test House Pvt Ltd", M + 12, 12);

  doc.setDrawColor(200);
  doc.line(M, 15, W - M, 15);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.sampleCode, M, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const lines: string[] = [
    `Product: ${clean(data.productName)}`,
    data.batchNumber ? `Batch/Lot: ${clean(data.batchNumber)}` : "",
    data.customerSampleRef ? `Cust. Ref: ${clean(data.customerSampleRef)}` : "",
    `Received: ${data.receivedDate}`,
    `Storage: ${clean(data.storageCondition)}`,
  ].filter(Boolean);
  let y = 26;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, 58);
    doc.text(wrapped, M, y);
    y += wrapped.length * 3.2;
  }

  if (data.handlingWarning) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(180, 60, 0);
    const warn = doc.splitTextToSize(`⚠ ${clean(data.handlingWarning)}`, 58);
    doc.text(warn, M, Math.min(y + 1, 46));
  }

  doc.addImage(data.barcodeDataUrl, "PNG", W - M - 26, 17, 26, 26);

  return doc;
}
