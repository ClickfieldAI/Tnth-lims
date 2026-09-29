import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TNTH_LOGO_BASE64 } from "./tnth-logo";

// Quotation PDF — same official TNTH branding/address block as the TEST
// REPORT template (lib/tnth-pdf.ts); company address/contact are copied
// verbatim from there rather than invented for this document.
const GREEN: [number, number, number] = [7, 120, 60];
const MARGIN = 40;

function clean(text: string): string {
  return (text || "").replace(/µ/g, "u").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/±/g, "+/-").replace(/°/g, "deg ").replace(/₹/g, "Rs. ");
}

function inr(n: number): string {
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Small-scale INR amount-in-words (sufficient for typical quotation totals).
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " + twoDigits(n % 100) : ""}`;
}
export function amountInWords(rupees: number): string {
  const n = Math.round(rupees);
  if (n === 0) return "Zero Rupees Only";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `${parts.join(" ")} Rupees Only`;
}

export interface QuotationPdfItem {
  slNo: number;
  productReference: string;
  serviceName: string;
  method: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface QuotationPdfData {
  quotationCode: string;
  revisionNumber: number;
  quotationDate: string;
  validUntil: string;
  enquiryCode: string;
  customerCode: string;
  customerName: string;
  contactPerson: string;
  billingAddress: string;
  gstNumber: string;
  customerEmail: string;
  customerPhone: string;
  items: QuotationPdfItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  estimatedTurnaroundDays: number;
  paymentTerms: string;
  status: string;
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
  doc.text("QUOTATION", pageWidth / 2, 100, { align: "center" });
  return 112;
}

function drawFooter(doc: jsPDF, quotationCode: string, revisionNumber: number, page: number, total: number) {
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
  doc.text(`${quotationCode} · Rev. ${revisionNumber}`, MARGIN, pageHeight - 20);
  doc.text(`Page ${page} of ${total}`, pageWidth - MARGIN, pageHeight - 20, { align: "right" });
}

function labelValue(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(clean(value) || "—", x, y + 11);
}

export function generateQuotationPdf(data: QuotationPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawHeader(doc);

  y += 14;
  labelValue(doc, MARGIN, y, "Quotation No.", data.quotationCode);
  labelValue(doc, MARGIN + 150, y, "Revision", String(data.revisionNumber));
  labelValue(doc, MARGIN + 240, y, "Quotation Date", data.quotationDate);
  labelValue(doc, MARGIN + 380, y, "Valid Until", data.validUntil);
  y += 30;
  labelValue(doc, MARGIN, y, "Enquiry Reference", data.enquiryCode);
  labelValue(doc, MARGIN + 240, y, "Customer ID", data.customerCode);
  y += 32;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("CUSTOMER", MARGIN, y);
  y += 14;
  labelValue(doc, MARGIN, y, "Name", data.customerName);
  labelValue(doc, MARGIN + 260, y, "Contact Person", data.contactPerson);
  y += 30;
  labelValue(doc, MARGIN, y, "Billing Address", data.billingAddress);
  y += 30;
  labelValue(doc, MARGIN, y, "Email", data.customerEmail);
  labelValue(doc, MARGIN + 200, y, "Phone", data.customerPhone);
  labelValue(doc, MARGIN + 380, y, "GST Number", data.gstNumber || "—");
  y += 34;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 90 },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 26, halign: "center" }, 1: { cellWidth: 90 }, 2: { cellWidth: 110 }, 3: { cellWidth: 78 },
      4: { cellWidth: 32, halign: "center" }, 5: { cellWidth: 55, halign: "right" }, 6: { cellWidth: 50, halign: "right" },
      7: { cellWidth: 45, halign: "right" }, 8: { cellWidth: 62, halign: "right" },
    },
    head: [["Sl.", "Product / Sample", "Test / Parameter", "Method", "Qty", "Unit Price", "Discount", "Tax", "Total"]],
    body: data.items.map((it) => [
      String(it.slNo), clean(it.productReference), clean(it.serviceName), clean(it.method || "—"),
      String(it.quantity), inr(it.unitPrice), inr(it.discount), inr(it.taxAmount), inr(it.lineTotal),
    ]),
    didDrawPage: () => {
      drawHeader(doc);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ny = (doc as any).lastAutoTable.finalY + 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (ny > pageHeight - 220) { doc.addPage(); ny = drawHeader(doc) + 20; }

  const summaryX = pageWidth - MARGIN - 200;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rows: [string, number][] = [
    ["Subtotal", data.subtotal], ["Discount", -data.discountTotal], ["Taxable Amount", data.taxableAmount], ["Tax", data.taxTotal],
  ];
  for (const [label, val] of rows) {
    doc.text(label, summaryX, ny);
    doc.text(inr(val), pageWidth - MARGIN, ny, { align: "right" });
    ny += 14;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Grand Total", summaryX, ny + 4);
  doc.text(inr(data.grandTotal), pageWidth - MARGIN, ny + 4, { align: "right" });
  ny += 22;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(`Amount in words: ${amountInWords(data.grandTotal)}`, MARGIN, ny);
  ny += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Additional Information", MARGIN, ny);
  ny += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const info = [
    `Estimated turnaround time: ${data.estimatedTurnaroundDays} working days from sample receipt.`,
    `Payment terms: ${data.paymentTerms || "As mutually agreed."}`,
    "This quotation is valid only until the date shown above.",
    "Prices are subject to change without notice after the validity period.",
    "Testing will commence only upon written/email confirmation of this quotation and receipt of samples in acceptable condition.",
  ];
  for (const line of info) {
    const wrapped = doc.splitTextToSize(line, pageWidth - MARGIN * 2);
    doc.text(wrapped, MARGIN, ny);
    ny += wrapped.length * 11;
  }

  ny += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Customer Acceptance", MARGIN, ny);
  ny += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Signature: _______________________     Name: _______________________     Date: ___________", MARGIN, ny);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawFooter(doc, data.quotationCode, data.revisionNumber, p, totalPages);
  }

  return doc;
}
