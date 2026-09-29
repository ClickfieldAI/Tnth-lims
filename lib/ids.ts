// Deterministic, human-readable unique code generators.
export function pad(n: number, width: number) {
  return n.toString().padStart(width, "0");
}

export function nextSampleCode(seq: number) {
  const year = new Date().getFullYear();
  return `SPL-${year}-${pad(seq, 5)}`;
}

export function nextBatchCode(seq: number) {
  const year = new Date().getFullYear();
  return `BAT-${year}-${pad(seq, 4)}`;
}

export function nextTestCode(seq: number, type = "TST") {
  return `${type.toUpperCase()}-${pad(seq, 4)}`;
}

export function nextReportCode(seq: number) {
  return `RPT-${new Date().getFullYear()}-${pad(seq, 4)}`;
}

export function nextDeviationCode(seq: number) {
  return `DEV-${new Date().getFullYear()}-${pad(seq, 4)}`;
}

export function nextCapaCode(seq: number) {
  return `CAPA-${new Date().getFullYear()}-${pad(seq, 4)}`;
}

export function nextChangeControlCode(seq: number) {
  return `CC-${new Date().getFullYear()}-${pad(seq, 4)}`;
}

export function nextDocCode(seq: number) {
  return `DOC-${new Date().getFullYear()}-${pad(seq, 4)}`;
}

export function nextStudyCode(seq: number) {
  return `STD-${new Date().getFullYear()}-${pad(seq, 3)}`;
}

export function nextInvoiceCode(seq: number) {
  return `INV-${new Date().getFullYear()}-${pad(seq, 4)}`;
}

export function nextClientCode(seq: number) {
  return `CL-${pad(seq, 3)}`;
}

export function nextProductCode(seq: number) {
  return `PRD-${pad(seq, 4)}`;
}

export function nextInstrumentCode(seq: number) {
  return `INS-${pad(seq, 4)}`;
}

export function nextEnquiryCode(seq: number) {
  return `ENQ-${new Date().getFullYear()}-${pad(seq, 5)}`;
}

export function nextQuotationCode(seq: number) {
  return `QUO-${new Date().getFullYear()}-${pad(seq, 5)}`;
}

// Sequence helpers are used by server actions that pass an explicit next value.