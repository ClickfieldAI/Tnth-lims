// Relation metadata for the in-memory mock "Prisma" client (lib/mock/engine.ts).
// Mirrors the foreign keys declared in prisma/schema.prisma so `include`/
// `select`/relation-`where` behave the same way real Prisma would, without a
// database. `toOne` = FK on THIS model pointing at the target's `id`.
// `toMany` = reverse side, resolved by scanning the target model for rows
// whose `fk` field equals this row's `id`.

export type RelationDef =
  | { type: "toOne"; model: string; fk: string }
  | { type: "toMany"; model: string; fk: string };

export const RELATIONS: Record<string, Record<string, RelationDef>> = {
  role: {
    users: { type: "toMany", model: "user", fk: "roleId" },
    permissions: { type: "toMany", model: "permissionRole", fk: "roleId" },
  },
  permission: {
    roles: { type: "toMany", model: "permissionRole", fk: "permissionId" },
  },
  permissionRole: {
    role: { type: "toOne", model: "role", fk: "roleId" },
    permission: { type: "toOne", model: "permission", fk: "permissionId" },
  },
  user: {
    role: { type: "toOne", model: "role", fk: "roleId" },
    client: { type: "toOne", model: "client", fk: "clientId" },
    assignedSamples: { type: "toMany", model: "sample", fk: "assignedToId" },
    samples: { type: "toMany", model: "sample", fk: "createdById" },
  },
  client: {
    users: { type: "toMany", model: "user", fk: "clientId" },
    samples: { type: "toMany", model: "sample", fk: "clientId" },
    products: { type: "toMany", model: "product", fk: "clientId" },
    invoices: { type: "toMany", model: "invoice", fk: "clientId" },
    messages: { type: "toMany", model: "message", fk: "clientId" },
    contacts: { type: "toMany", model: "customerContact", fk: "customerId" },
    documents: { type: "toMany", model: "customerDocument", fk: "customerId" },
  },
  customerContact: { customer: { type: "toOne", model: "client", fk: "customerId" } },
  customerDocument: { customer: { type: "toOne", model: "client", fk: "customerId" } },
  enquiry: {
    customer: { type: "toOne", model: "client", fk: "customerId" },
    assignedManager: { type: "toOne", model: "user", fk: "assignedManagerId" },
    products: { type: "toMany", model: "enquiryProduct", fk: "enquiryId" },
    quotations: { type: "toMany", model: "quotation", fk: "enquiryId" },
  },
  enquiryProduct: {
    enquiry: { type: "toOne", model: "enquiry", fk: "enquiryId" },
    tests: { type: "toMany", model: "enquiryTestRequest", fk: "enquiryProductId" },
  },
  enquiryTestRequest: {
    product: { type: "toOne", model: "enquiryProduct", fk: "enquiryProductId" },
  },
  quotation: {
    enquiry: { type: "toOne", model: "enquiry", fk: "enquiryId" },
    customer: { type: "toOne", model: "client", fk: "customerId" },
    items: { type: "toMany", model: "quotationItem", fk: "quotationId" },
    history: { type: "toMany", model: "quotationHistory", fk: "quotationId" },
    preparedBy: { type: "toOne", model: "user", fk: "preparedById" },
    approvedBy: { type: "toOne", model: "user", fk: "approvedById" },
    previousVersion: { type: "toOne", model: "quotation", fk: "previousVersionId" },
  },
  quotationItem: {
    quotation: { type: "toOne", model: "quotation", fk: "quotationId" },
    testRequest: { type: "toOne", model: "enquiryTestRequest", fk: "testRequestId" },
  },
  quotationHistory: {
    quotation: { type: "toOne", model: "quotation", fk: "quotationId" },
    createdBy: { type: "toOne", model: "user", fk: "createdById" },
  },
  invoice: {
    client: { type: "toOne", model: "client", fk: "clientId" },
    samples: { type: "toMany", model: "sample", fk: "invoiceId" },
  },
  product: {
    client: { type: "toOne", model: "client", fk: "clientId" },
    batches: { type: "toMany", model: "batch", fk: "productId" },
    samples: { type: "toMany", model: "sample", fk: "productId" },
    stabilityStudies: { type: "toMany", model: "stabilityStudy", fk: "productId" },
  },
  batch: {
    product: { type: "toOne", model: "product", fk: "productId" },
    samples: { type: "toMany", model: "sample", fk: "batchId" },
    stabilityStudies: { type: "toMany", model: "stabilityStudy", fk: "batchId" },
    coaReports: { type: "toMany", model: "testReport", fk: "batchId" },
  },
  sample: {
    client: { type: "toOne", model: "client", fk: "clientId" },
    product: { type: "toOne", model: "product", fk: "productId" },
    batch: { type: "toOne", model: "batch", fk: "batchId" },
    assignedTo: { type: "toOne", model: "user", fk: "assignedToId" },
    createdBy: { type: "toOne", model: "user", fk: "createdById" },
    invoice: { type: "toOne", model: "invoice", fk: "invoiceId" },
    tests: { type: "toMany", model: "test", fk: "sampleId" },
    custodyRecords: { type: "toMany", model: "chainOfCustody", fk: "sampleId" },
    storageEvents: { type: "toMany", model: "storageEvent", fk: "sampleId" },
    testReports: { type: "toMany", model: "testReport", fk: "sampleId" },
    deviations: { type: "toMany", model: "deviation", fk: "sampleId" },
    messages: { type: "toMany", model: "message", fk: "sampleId" },
    attachedDocuments: { type: "toMany", model: "document", fk: "sampleId" },
  },
  chainOfCustody: {
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
  },
  storageEvent: {
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
  },
  test: {
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
    assignedTo: { type: "toOne", model: "user", fk: "assignedToId" },
    instrument: { type: "toOne", model: "instrument", fk: "instrumentId" },
    approvedBy: { type: "toOne", model: "user", fk: "approvedById" },
    assayResult: { type: "toOne", model: "assayResult", fk: "id" }, // resolved specially (reverse 1:1)
    dissolution: { type: "toOne", model: "dissolutionResult", fk: "id" },
    impurityResult: { type: "toOne", model: "impurityResult", fk: "id" },
    microbiology: { type: "toOne", model: "microbiologyResult", fk: "id" },
    report: { type: "toOne", model: "testReport", fk: "id" },
    stabilityTimepoints: { type: "toMany", model: "stabilityTimepoint", fk: "testId" },
    deviations: { type: "toMany", model: "deviation", fk: "testId" },
  },
  assayResult: { test: { type: "toOne", model: "test", fk: "testId" } },
  dissolutionResult: { test: { type: "toOne", model: "test", fk: "testId" } },
  impurityResult: { test: { type: "toOne", model: "test", fk: "testId" } },
  microbiologyResult: { test: { type: "toOne", model: "test", fk: "testId" } },
  stabilityStudy: {
    product: { type: "toOne", model: "product", fk: "productId" },
    batch: { type: "toOne", model: "batch", fk: "batchId" },
    timepoints: { type: "toMany", model: "stabilityTimepoint", fk: "studyId" },
  },
  stabilityTimepoint: {
    study: { type: "toOne", model: "stabilityStudy", fk: "studyId" },
    test: { type: "toOne", model: "test", fk: "testId" },
  },
  instrument: {
    calibrations: { type: "toMany", model: "calibrationRecord", fk: "instrumentId" },
    tests: { type: "toMany", model: "test", fk: "instrumentId" },
    maintenanceLogs: { type: "toMany", model: "maintenanceLog", fk: "instrumentId" },
  },
  calibrationRecord: { instrument: { type: "toOne", model: "instrument", fk: "instrumentId" } },
  maintenanceLog: { instrument: { type: "toOne", model: "instrument", fk: "instrumentId" } },
  deviation: {
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
    test: { type: "toOne", model: "test", fk: "testId" },
    reportedBy: { type: "toOne", model: "user", fk: "reportedById" },
    capas: { type: "toMany", model: "capa", fk: "relatedDeviationId" },
  },
  capa: {
    owner: { type: "toOne", model: "user", fk: "ownerId" },
    relatedDeviation: { type: "toOne", model: "deviation", fk: "relatedDeviationId" },
  },
  changeControl: {
    approvedBy: { type: "toOne", model: "user", fk: "approvedById" },
  },
  document: {
    approvedBy: { type: "toOne", model: "user", fk: "approvedByUserId" },
    owner: { type: "toOne", model: "user", fk: "ownerId" },
    previousVersion: { type: "toOne", model: "document", fk: "previousVersionId" },
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
    report: { type: "toOne", model: "testReport", fk: "reportId" },
    downloadHistory: { type: "toMany", model: "downloadRecord", fk: "documentId" },
  },
  downloadRecord: { document: { type: "toOne", model: "document", fk: "documentId" } },
  testReport: {
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
    batch: { type: "toOne", model: "batch", fk: "batchId" },
    test: { type: "toOne", model: "test", fk: "testId" },
    approvedBy: { type: "toOne", model: "user", fk: "approvedById" },
    documents: { type: "toMany", model: "document", fk: "reportId" },
  },
  approval: { approver: { type: "toOne", model: "user", fk: "approverId" } },
  auditLog: { actor: { type: "toOne", model: "user", fk: "actorId" } },
  message: {
    client: { type: "toOne", model: "client", fk: "clientId" },
    sample: { type: "toOne", model: "sample", fk: "sampleId" },
    author: { type: "toOne", model: "user", fk: "authorId" },
  },
};

// Models where the relation is a reverse 1:1 (the FK lives on the OTHER
// model, e.g. AssayResult.testId), not a forward FK on this row — resolved
// by scanning rather than by `row[fk]`.
export const REVERSE_ONE_TO_ONE: Record<string, Record<string, { model: string; fk: string }>> = {
  test: {
    assayResult: { model: "assayResult", fk: "testId" },
    dissolution: { model: "dissolutionResult", fk: "testId" },
    impurityResult: { model: "impurityResult", fk: "testId" },
    microbiology: { model: "microbiologyResult", fk: "testId" },
    report: { model: "testReport", fk: "testId" },
  },
};
