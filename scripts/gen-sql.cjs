/* Generates Postgres DDL + data SQL from the inferred schema + dumped data.
 * Output: writes 3 SQL strings to .sql/ for applying to Supabase. */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const types = JSON.parse(fs.readFileSync(path.join(ROOT, ".schema-infer.json"), "utf8"));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, ".schema-data.json"), "utf8"));

// Foreign keys: [model, column, targetModel] — reverse-1:1 (fk:"id") excluded.
const FKS = [
  ["permissionRole","roleId","role"],["permissionRole","permissionId","permission"],
  ["user","roleId","role"],["user","clientId","client"],
  ["customerContact","customerId","client"],["customerDocument","customerId","client"],
  ["enquiry","customerId","client"],["enquiry","assignedManagerId","user"],
  ["enquiryProduct","enquiryId","enquiry"],["enquiryTestRequest","enquiryProductId","enquiryProduct"],
  ["quotation","enquiryId","enquiry"],["quotation","customerId","client"],["quotation","preparedById","user"],["quotation","approvedById","user"],["quotation","previousVersionId","quotation"],
  ["quotationItem","quotationId","quotation"],["quotationItem","testRequestId","enquiryTestRequest"],
  ["quotationHistory","quotationId","quotation"],["quotationHistory","createdById","user"],
  ["invoice","clientId","client"],
  ["trf","customerId","client"],["trf","quotationId","quotation"],["trf","createdById","user"],["trf","submittedById","user"],["trf","receiptConfirmedById","user"],
  ["trfSample","trfId","trf"],
  ["sampleReceipt","trfId","trf"],["sampleReceipt","trfSampleId","trfSample"],["sampleReceipt","receivedById","user"],
  ["technicalReview","trfId","trf"],["technicalReview","trfSampleId","trfSample"],["technicalReview","reviewedById","user"],
  ["technicalReviewHistory","technicalReviewId","technicalReview"],["technicalReviewHistory","actorId","user"],
  ["sampleRegistration","trfId","trf"],["sampleRegistration","trfSampleId","trfSample"],["sampleRegistration","customerId","client"],["sampleRegistration","registeredById","user"],["sampleRegistration","cancelledById","user"],
  ["testAllocation","trfTestRequestId","trfTestRequest"],["testAllocation","analystId","user"],["testAllocation","instrumentId","instrument"],["testAllocation","allocatedById","user"],
  ["worksheet","analystId","user"],["worksheet","instrumentId","instrument"],["worksheet","createdById","user"],
  ["worksheetItem","worksheetId","worksheet"],["worksheetItem","testAllocationId","testAllocation"],
  ["testResult","testAllocationId","testAllocation"],["testResult","worksheetId","worksheet"],["testResult","analystId","user"],["testResult","instrumentUsedId","instrument"],
  ["technicalVerification","testResultId","testResult"],["technicalVerification","reviewerId","user"],
  ["draftReport","sampleRegistrationId","sampleRegistration"],["draftReport","trfId","trf"],["draftReport","customerId","client"],["draftReport","preparedById","user"],["draftReport","previousVersionId","draftReport"],
  ["draftReportItem","draftReportId","draftReport"],["draftReportItem","testAllocationId","testAllocation"],
  ["qaReview","draftReportId","draftReport"],["qaReview","reviewerId","user"],
  ["reportRelease","draftReportId","draftReport"],["reportRelease","releasedById","user"],
  ["reportDelivery","draftReportId","draftReport"],["reportDelivery","customerId","client"],["reportDelivery","deliveredById","user"],
  ["retentionRecord","sampleRegistrationId","sampleRegistration"],["retentionRecord","trfId","trf"],["retentionRecord","customerId","client"],["retentionRecord","disposedById","user"],
  ["correction","draftReportId","draftReport"],["correction","sampleRegistrationId","sampleRegistration"],["correction","customerId","client"],["correction","requestedById","user"],["correction","reviewedById","user"],["correction","newRevisionId","draftReport"],
  ["trfTestRequest","trfSampleId","trfSample"],
  ["trfDocument","trfId","trf"],["trfDocument","uploadedById","user"],
  ["trfAuthorization","trfId","trf"],["trfAuthorization","signedTrfDocumentId","trfDocument"],
  ["trfReviewHistory","trfId","trf"],["trfReviewHistory","actorId","user"],
  ["product","clientId","client"],
  ["batch","productId","product"],
  ["sample","clientId","client"],["sample","productId","product"],["sample","batchId","batch"],["sample","assignedToId","user"],["sample","createdById","user"],["sample","invoiceId","invoice"],
  ["chainOfCustody","sampleId","sample"],
  ["storageEvent","sampleId","sample"],
  ["test","sampleId","sample"],["test","assignedToId","user"],["test","instrumentId","instrument"],["test","approvedById","user"],
  ["assayResult","testId","test"],["dissolutionResult","testId","test"],["impurityResult","testId","test"],["microbiologyResult","testId","test"],
  ["stabilityStudy","productId","product"],["stabilityStudy","batchId","batch"],
  ["stabilityTimepoint","studyId","stabilityStudy"],["stabilityTimepoint","testId","test"],
  ["calibrationRecord","instrumentId","instrument"],["maintenanceLog","instrumentId","instrument"],
  ["deviation","sampleId","sample"],["deviation","testId","test"],["deviation","reportedById","user"],
  ["capa","ownerId","user"],["capa","relatedDeviationId","deviation"],
  ["changeControl","approvedById","user"],
  ["document","approvedByUserId","user"],["document","ownerId","user"],["document","previousVersionId","document"],["document","sampleId","sample"],["document","reportId","testReport"],
  ["downloadRecord","documentId","document"],
  ["testReport","sampleId","sample"],["testReport","batchId","batch"],["testReport","testId","test"],["testReport","approvedById","user"],
  ["approval","approverId","user"],
  ["auditLog","actorId","user"],
  ["message","clientId","client"],["message","sampleId","sample"],["message","authorId","user"],
];

// Manual column specs for tables empty in the demo (no inferred fields).
const MANUAL = {
  customerContact: { customerId:"text", name:"text", designation:"text", email:"text", phone:"text", isPrimary:"boolean", createdAt:"timestamptz", updatedAt:"timestamptz" },
  customerDocument: { customerId:"text", docType:"text", fileName:"text", sizeBytes:"double precision", mimeType:"text", uploadedById:"text", uploadedAt:"timestamptz", createdAt:"timestamptz", updatedAt:"timestamptz" },
  chainOfCustody: { sampleId:"text", fromUserId:"text", toUserId:"text", action:"text", locationNote:"text", note:"text", createdAt:"timestamptz", updatedAt:"timestamptz" },
  storageEvent: { sampleId:"text", eventType:"text", note:"text", location:"text", createdAt:"timestamptz", updatedAt:"timestamptz" },
  calibrationRecord: { instrumentId:"text", performedAt:"timestamptz", dueAt:"timestamptz", result:"text", note:"text", createdAt:"timestamptz", updatedAt:"timestamptz" },
  maintenanceLog: { instrumentId:"text", performedAt:"timestamptz", type:"text", note:"text", createdAt:"timestamptz", updatedAt:"timestamptz" },
  approval: { referenceType:"text", referenceId:"text", approverId:"text", action:"text", meaning:"text", comment:"text", recordSnapshot:"jsonb", createdAt:"timestamptz", updatedAt:"timestamptz" },
  message: { clientId:"text", authorId:"text", sampleId:"text", body:"text", fromClient:"boolean", createdAt:"timestamptz", updatedAt:"timestamptz" },
  quotationHistory: { quotationId:"text", revisionNumber:"double precision", previousVersionReference:"text", revisionReason:"text", snapshot:"jsonb", createdById:"text", createdAt:"timestamptz", updatedAt:"timestamptz" },
  trfDocument: { trfId:"text", docType:"text", fileName:"text", sizeBytes:"double precision", mimeType:"text", uploadedById:"text", uploadedAt:"timestamptz", createdAt:"timestamptz", updatedAt:"timestamptz" },
  downloadRecord: { documentId:"text", userId:"text", ip:"text", createdAt:"timestamptz", updatedAt:"timestamptz" },
};

const MODELS = Object.keys(types);

// Columns the app reads/writes that the demo data never populated, so column
// inference missed them. Added so real Prisma accepts the same queries the
// in-memory mock silently tolerated.
const EXTRA_COLUMNS = {
  testAllocation: { status: "text" },
};

function sqlType(info) {
  const t = info.types || [];
  if (t.includes("Json")) return "jsonb";
  if (t.includes("String")) return "text";
  // Use double precision for ALL numerics (not bigint): Prisma maps bigint to
  // JS BigInt, but the app does ordinary number math and money can be
  // fractional. double precision → Prisma Float → number.
  if (t.includes("Float") || t.includes("Int")) return "double precision";
  if (t.includes("Boolean")) return "boolean";
  if (t.includes("DateTime")) return "timestamptz";
  return "text";
}

// Build per-table column map {col: pgtype}
const columns = {};
for (const m of MODELS) {
  const cols = {};
  const inferred = types[m] || {};
  for (const [c, info] of Object.entries(inferred)) {
    // Columns that are null across every seeded row have no inferred type and
    // fall back to text; if the name looks like a timestamp, make it one so
    // the app writing `new Date()` (e.g. lastLoginAt) maps cleanly.
    cols[c] = (info.types.length === 0 && /(At|Date)$/.test(c)) ? "timestamptz" : sqlType(info);
  }
  if (MANUAL[m]) for (const [c, tp] of Object.entries(MANUAL[m])) if (!cols[c]) cols[c] = tp;
  if (EXTRA_COLUMNS[m]) for (const [c, tp] of Object.entries(EXTRA_COLUMNS[m])) if (!cols[c]) cols[c] = tp;
  // ensure FK columns exist
  for (const [model, col] of FKS) if (model === m && !cols[col]) cols[col] = "text";
  // ensure id/createdAt/updatedAt
  cols.id = "text";
  if (!cols.createdAt) cols.createdAt = "timestamptz";
  columns[m] = cols;
}

function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
function lit(val, pgtype) {
  if (val === null || val === undefined) return "NULL";
  if (pgtype === "jsonb") return q(JSON.stringify(val)) + "::jsonb";
  if (pgtype === "timestamptz") return q(val) + "::timestamptz";
  if (pgtype === "boolean") return val ? "true" : "false";
  if (pgtype === "double precision" || pgtype === "double precision") {
    return (typeof val === "number") ? String(val) : q(val) + "::" + pgtype;
  }
  return q(typeof val === "object" ? JSON.stringify(val) : val);
}

// 01 tables
let tables = "";
for (const m of MODELS) {
  const cols = columns[m];
  const defs = Object.entries(cols).map(([c, tp]) => {
    let line = `  "${c}" ${tp}`;
    if (c === "id") line += " primary key";
    return line;
  });
  tables += `create table if not exists "${m}" (\n${defs.join(",\n")}\n);\n`;
}

// 02 data (per-table INSERTs)
let inserts = "";
for (const m of MODELS) {
  const rows = data[m] || [];
  if (!rows.length) continue;
  const cols = Object.keys(columns[m]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  rows.forEach((row, i) => {
    // Some seeded join rows (e.g. permissionRole) have no id; synthesize a
    // stable one so the text primary key is never null.
    if (row.id === undefined || row.id === null) row.id = `${m}_${i + 1}`;
    const vals = cols.map((c) => lit(row[c], columns[m][c])).join(", ");
    inserts += `insert into "${m}" (${colList}) values (${vals});\n`;
  });
}

// 03 fks (added after data load; one statement each so a bad one can be skipped)
let fks = "";
let fkn = 0;
for (const [m, col, target] of FKS) {
  if (!columns[m] || !columns[m][col]) continue;
  fkn++;
  fks += `alter table "${m}" add constraint "fk_${m}_${col}" foreign key ("${col}") references "${target}"("id");\n`;
}

// 00 drop fks (so data can load without ordering/circular-ref problems)
let dropFks = "";
for (const [m, col] of FKS) {
  if (!columns[m] || !columns[m][col]) continue;
  dropFks += `alter table "${m}" drop constraint if exists "fk_${m}_${col}";\n`;
}

// truncate all tables (run after drop-fks)
const truncate = "truncate table " + MODELS.map((m) => `"${m}"`).join(", ") + ";\n";

fs.mkdirSync(path.join(ROOT, ".sql"), { recursive: true });
fs.writeFileSync(path.join(ROOT, ".sql/00_drop_fks.sql"), dropFks);
fs.writeFileSync(path.join(ROOT, ".sql/00_truncate.sql"), truncate);
fs.writeFileSync(path.join(ROOT, ".fks.json"), JSON.stringify(FKS));
fs.writeFileSync(path.join(ROOT, ".columns.json"), JSON.stringify(columns, null, 2));
fs.writeFileSync(path.join(ROOT, ".sql/01_tables.sql"), tables);
fs.writeFileSync(path.join(ROOT, ".sql/02_data.sql"), inserts);
fs.writeFileSync(path.join(ROOT, ".sql/03_fks.sql"), fks);
console.log(`tables=${MODELS.length} fkConstraints=${fkn} dataStatements=${inserts.split("\n").length - 1}`);
console.log(`bytes: tables=${tables.length} data=${inserts.length} fks=${fks.length}`);
