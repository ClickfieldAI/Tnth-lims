import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { TNTH_LOGO_BASE64 } from "./tnth-logo";
import type { TnthReportData } from "./tnth-report";

// Faithful reproduction of the official Tamilnadu Test House "TEST REPORT"
// template (source: client-supplied M-2841 report). This is a controlled
// document format — do not restyle it into a generic/modern layout.

const GREEN: [number, number, number] = [7, 120, 60];
const MARGIN = 40;
const HEADER_BOTTOM = 158; // y where the report-no/date bar ends
const RESERVED_BOTTOM = 150; // space reserved at the bottom of every page for signature + footer

// jsPDF's core fonts only support WinAnsi encoding — sanitize characters
// (µ, ≤, ≥, °) that would otherwise render as mojibake/garbled glyphs.
function clean(text: string): string {
  return text
    .replace(/µ/g, "u")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/±/g, "+/-")
    .replace(/°/g, "deg ");
}

function drawHeader(doc: jsPDF, reportNo: string, date: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.addImage(TNTH_LOGO_BASE64, "PNG", MARGIN, 26, 68, 68);

  doc.setTextColor(...GREEN);
  doc.setFont("times", "bold");
  doc.setFontSize(19);
  doc.text("TAMILNADU TEST HOUSE", pageWidth / 2 + 25, 46, { align: "center" });
  doc.text("PRIVATE LIMITED", pageWidth / 2 + 25, 67, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.text("www.tamilnadutesthouse.com", pageWidth / 2 + 25, 82, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text("TEST REPORT", pageWidth / 2, 112, { align: "center" });

  const barY = 122;
  doc.setDrawColor(0);
  doc.setLineWidth(0.75);
  doc.rect(MARGIN, barY, pageWidth - MARGIN * 2, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`TEST REPORT NO: ${reportNo}`, MARGIN + 6, barY + 12);
  doc.text(`DATE:${date}`, pageWidth - MARGIN - 6, barY + 12, { align: "right" });

  return barY + 18;
}

function drawSampleSubmittedHeading(doc: jsPDF, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("SAMPLE SUBMITTED BY CUSTOMER", pageWidth / 2, y + 14, { align: "center" });
  return y + 24;
}

function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineY = pageHeight - 56;
  const y = lineY + 13;

  doc.setDrawColor(190);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, lineY, pageWidth - MARGIN, lineY);

  const centerX = pageWidth / 2;
  doc.setFont("times", "normal");
  doc.setTextColor(...GREEN);
  doc.setFontSize(8);
  doc.text("Sri Sai Building, Plot No.31 & 32, Lakshmi Kanthammal Street,", centerX - 10, y, { align: "right" });
  doc.text("Rajiv Nagar, Vanagaram, Chennai - 600 077.", centerX - 10, y + 11, { align: "right" });
  doc.line(centerX, y - 8, centerX, y + 14);
  doc.text("P: 91 7550053001", centerX + 10, y, { align: "left" });
  doc.text("E: info@tn-th.com", centerX + 10, y + 11, { align: "left" });
}

function drawPageNumber(doc: jsPDF, page: number, total: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9.5);
  doc.text(`Page ${page} of ${total}`, pageWidth / 2, pageHeight - 78, { align: "center" });
}

function drawSignatureBlock(doc: jsPDF, verifiedBy: string, authorisedSignatory: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const labelY = pageHeight - 128;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("For Tamilnadu Test House Private Limited", pageWidth - MARGIN, labelY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(clean(verifiedBy), MARGIN, labelY + 32);
  doc.text(clean(authorisedSignatory), pageWidth - MARGIN, labelY + 32, { align: "right" });
}

function labelValueRow(doc: jsPDF, y: number, label: string, value: string, valueBold = false, maxWidth = 340) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(label, MARGIN, y);
  doc.setFont("helvetica", valueBold ? "bold" : "normal");
  const lines = doc.splitTextToSize(clean(value), maxWidth);
  doc.text(lines, MARGIN + 158, y);
  return y + 16 * Math.max(1, lines.length);
}

export function generateTnthReportPdf(data: TnthReportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---------- Page 1: sample submission details ----------
  let y = drawHeader(doc, data.reportNo, data.date);
  y = drawSampleSubmittedHeading(doc, y);

  y = labelValueRow(doc, y, "CUSTOMER DETAILS", data.customerName, true);
  y = labelValueRow(doc, y, "ADDRESS", data.address);
  y = labelValueRow(doc, y, "SAMPLE DESCRIPTION", data.sampleDescription);
  y = labelValueRow(doc, y, "BATCH NO", data.batchNo);
  y = labelValueRow(doc, y, "SAMPLE QUANTITY", data.sampleQuantity);
  y = labelValueRow(doc, y, "PACKING CONDITION", data.packingCondition);
  y = labelValueRow(doc, y, "SAMPLE RECEIVED ON", data.sampleReceivedOn);
  y = labelValueRow(doc, y, "ANALYSIS STARTED ON", data.analysisStartedOn);
  y = labelValueRow(doc, y, "ANALYSIS COMPLETED ON", data.analysisCompletedOn);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Terms and Conditions", MARGIN, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const terms =
    "This report in full or in part shall not be published, advertised, used for any legal action, unless prior " +
    "permission has been secured. This test report pertains only for the sample tested and such samples are " +
    "retained for 7 days (in case of perishable) and 15 days for all other samples. In case of Complaint received " +
    "from customers sample will be kept for 30 days. The samples from regulatory bodies are to be retained as " +
    "specified. This document cannot be reproduced except in full, without prior written approval of the company.";
  const termLines = doc.splitTextToSize(terms, pageWidth - MARGIN * 2);
  doc.text(termLines, MARGIN, y);
  y += termLines.length * 11 + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("For Tamilnadu Test House Private Limited", pageWidth - MARGIN, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Managing Director", pageWidth - MARGIN, y + 34, { align: "right" });
  drawFooter(doc);

  // ---------- Page 2+: results table (auto-paginated) ----------
  doc.addPage();

  const columns = ["S. NO", "PARAMETERS", "METHOD", "UNITS", "RESULTS", "LIMITS"];
  const hasAnyLimit = data.sections.some((s) => s.rows.some((r) => r.limit !== "—"));
  const cols = hasAnyLimit ? columns : columns.slice(0, 5);

  const body: RowInput[] = [];
  for (const section of data.sections) {
    body.push([{ content: clean(section.heading), colSpan: cols.length, styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "left" } }]);

    // Merge consecutive identical METHOD values into a single spanning cell,
    // matching the reference (e.g. one FSSAI method spanning several rows).
    let i = 0;
    while (i < section.rows.length) {
      const row = section.rows[i];
      let span = 1;
      while (i + span < section.rows.length && section.rows[i + span].method === row.method) span++;

      const cells: RowInput = [
        { content: row.sNo, styles: { halign: "center" } },
        { content: clean(row.parameter), styles: { halign: "left" } },
        span > 1
          ? { content: clean(row.method), rowSpan: span, styles: { halign: "center", valign: "middle" } }
          : { content: clean(row.method), styles: { halign: "center" } },
        { content: clean(row.unit), styles: { halign: "center" } },
        { content: clean(row.result), styles: { halign: "center" } },
      ];
      if (hasAnyLimit) cells.push({ content: clean(row.limit), styles: { halign: "center" } });
      body.push(cells);

      for (let k = 1; k < span; k++) {
        const r = section.rows[i + k];
        const spannedCells: RowInput = [
          { content: r.sNo, styles: { halign: "center" } },
          { content: clean(r.parameter), styles: { halign: "left" } },
          // method cell omitted here — covered by the rowSpan above
          { content: clean(r.unit), styles: { halign: "center" } },
          { content: clean(r.result), styles: { halign: "center" } },
        ];
        if (hasAnyLimit) spannedCells.push({ content: clean(r.limit), styles: { halign: "center" } });
        body.push(spannedCells);
      }
      i += span;
    }
  }

  const tableTop = HEADER_BOTTOM + 90;
  autoTable(doc, {
    startY: tableTop,
    margin: { top: tableTop, left: MARGIN, right: MARGIN, bottom: RESERVED_BOTTOM },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", lineWidth: 0.75 },
    columnStyles: hasAnyLimit
      ? { 0: { cellWidth: 38 }, 1: { cellWidth: 148 }, 2: { cellWidth: 112 }, 3: { cellWidth: 58 }, 4: { cellWidth: 65 }, 5: { cellWidth: 94 } }
      : { 0: { cellWidth: 38 }, 1: { cellWidth: 186 }, 2: { cellWidth: 148 }, 3: { cellWidth: 68 }, 4: { cellWidth: 75 } },
    head: [cols],
    body,
    didDrawPage: () => {
      drawHeader(doc, data.reportNo, data.date);
      let hy = drawSampleSubmittedHeading(doc, HEADER_BOTTOM);
      hy = labelValueRow(doc, hy, "SAMPLE DESCRIPTION", data.sampleDescription, false, 300);
      hy = labelValueRow(doc, hy, "ANALYSIS STARTED ON", data.analysisStartedOn, false, 300);
      labelValueRow(doc, hy, "ANALYSIS COMPLETED ON", data.analysisCompletedOn, false, 300);

      drawFooter(doc);
      drawSignatureBlock(doc, data.verifiedBy, data.authorisedSignatory);
    },
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const notesY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  if (notesY < doc.internal.pageSize.getHeight() - RESERVED_BOTTOM) {
    doc.text("BQL- Below Quantification Limit, LOQ - Limit of Quantification", MARGIN, notesY);
  }

  // Back-fill "Page X of Y" (total page count only known once content is complete).
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageNumber(doc, p, totalPages);
  }

  return doc;
}
