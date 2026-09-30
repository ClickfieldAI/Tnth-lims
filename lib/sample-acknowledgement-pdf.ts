import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TNTH_LOGO_BASE64 } from "./tnth-logo";

// Sample Registration Acknowledgement — same official TNTH branding and
// company address/contact block as the existing TEST REPORT and QUOTATION
// templates (lib/tnth-pdf.ts, lib/quotation-pdf.ts); nothing here is invented.
const GREEN: [number, number, number] = [7, 120, 60];
const MARGIN = 40;

function clean(text: string): string {
  return (text || "").replace(/µ/g, "u").replace(/±/g, "+/-").replace(/°/g, "deg ").replace(/₹/g, "Rs. ");
}

export interface SampleAcknowledgementData {
  acknowledgementNumber: string;
  sampleCode: string;
  trfCode: string;
  customerName: string;
  customerCode: string;
  productName: string;
  batchNumber?: string;
  customerSampleRef?: string;
  quantity: string;
  containers: number;
  receivedAt: string;
  registeredAt: string;
  registeredByName: string;
  requestedTests: string[];
  storageCondition: string;
  storageLocation?: string;
  remarks?: string;
  barcodeDataUrl: string;
}

function drawHeader(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.addImage(TNTH_LOGO_BASE64, "PNG", MARGIN, 26, 60, 60);
  doc.setTextColor(...GREEN);
  doc.setFont("times", "bold");
  doc.setFontSize(17);
  doc.text("TAMILNADU TEST HOUSE", pageWidth / 2 + 20, 42, { align: "center" });
  doc.text("PRIVATE LIMITED", pageWidth / 2 + 20, 61, { align: "center" });
  doc.setFontSize(9.5);
  doc.text("www.tamilnadutesthouse.com", pageWidth / 2 + 20, 75, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text("SAMPLE REGISTRATION ACKNOWLEDGEMENT", pageWidth / 2, 100, { align: "center" });
  return 112;
}

function drawFooter(doc: jsPDF, ackNo: string, page: number, total: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineY = pageHeight - 56;
  doc.setDrawColor(190);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, lineY, pageWidth - MARGIN, lineY);
  const y = lineY + 13;
  const centerX = pageWidth / 2;
  doc.setFont("times", "normal");
  doc.setTextColor(...GREEN);
  doc.setFontSize(8);
  doc.text("Sri Sai Building, Plot No.31 & 32, Lakshmi Kanthammal Street,", centerX - 10, y, { align: "right" });
  doc.text("Rajiv Nagar, Vanagaram, Chennai - 600 077.", centerX - 10, y + 11, { align: "right" });
  doc.line(centerX, y - 8, centerX, y + 14);
  doc.text("P: 91 7550053001", centerX + 10, y, { align: "left" });
  doc.text("E: info@tn-th.com", centerX + 10, y + 11, { align: "left" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text(ackNo, MARGIN, pageHeight - 20);
  doc.text(`Page ${page} of ${total}`, pageWidth - MARGIN, pageHeight - 20, { align: "right" });
}

function labelValue(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(clean(value) || "—", x, y + 11);
}

export function generateSampleAcknowledgementPdf(data: SampleAcknowledgementData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawHeader(doc);

  y += 14;
  labelValue(doc, MARGIN, y, "Acknowledgement No.", data.acknowledgementNumber);
  labelValue(doc, MARGIN + 200, y, "Sample ID", data.sampleCode);
  labelValue(doc, MARGIN + 360, y, "TRF Number", data.trfCode);
  y += 34;
  labelValue(doc, MARGIN, y, "Customer", `${data.customerCode} — ${data.customerName}`);
  y += 30;

  doc.addImage(data.barcodeDataUrl, "PNG", pageWidth - MARGIN - 80, 112, 80, 80);

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("SAMPLE DETAILS", MARGIN, y);
  y += 14;
  labelValue(doc, MARGIN, y, "Product / Sample", data.productName);
  labelValue(doc, MARGIN + 260, y, "Batch / Lot", data.batchNumber ?? "—");
  y += 30;
  labelValue(doc, MARGIN, y, "Customer Sample Ref.", data.customerSampleRef ?? "—");
  labelValue(doc, MARGIN + 260, y, "Quantity Received", `${data.quantity} · ${data.containers} container(s)`);
  y += 30;
  labelValue(doc, MARGIN, y, "Received Date/Time", data.receivedAt);
  labelValue(doc, MARGIN + 260, y, "Registered Date/Time", data.registeredAt);
  y += 30;
  labelValue(doc, MARGIN, y, "Registered By", data.registeredByName);
  labelValue(doc, MARGIN + 260, y, "Storage", `${data.storageCondition}${data.storageLocation ? " · " + data.storageLocation : ""}`);
  y += 36;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 90 },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "left" },
    head: [["Sl.", "Requested Test"]],
    body: data.requestedTests.map((t, i) => [String(i + 1), clean(t)]),
    didDrawPage: () => { drawHeader(doc); },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ny = (doc as any).lastAutoTable.finalY + 24;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (ny > pageHeight - 150) { doc.addPage(); ny = drawHeader(doc) + 24; }

  if (data.remarks) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Remarks", MARGIN, ny);
    ny += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const wrapped = doc.splitTextToSize(clean(data.remarks), pageWidth - MARGIN * 2);
    doc.text(wrapped, MARGIN, ny);
    ny += wrapped.length * 11 + 14;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("This acknowledgement confirms sample registration into the laboratory information system. It does not constitute a test result or certificate of analysis.", MARGIN, ny, { maxWidth: pageWidth - MARGIN * 2 });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawFooter(doc, data.acknowledgementNumber, p, totalPages);
  }

  return doc;
}
