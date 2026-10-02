// In-memory mock Prisma client — used ONLY by the test suite (vitest), so the
// ~260 service tests stay fast, isolated and DB-free. The real app uses the
// PostgreSQL-backed client in lib/prisma.ts. This reuses the same tiny query
// engine the whole app ran on before the Supabase migration.
import { makeModel, type DB } from "./mock/engine";
import { buildSeedDb } from "./mock/seed-data";

const MODELS = [
  "permission", "role", "permissionRole", "user",
  "client", "customerContact", "customerDocument", "invoice", "product", "batch", "sample",
  "chainOfCustody", "storageEvent", "test",
  "assayResult", "dissolutionResult", "impurityResult", "microbiologyResult",
  "stabilityStudy", "stabilityTimepoint",
  "instrument", "calibrationRecord", "maintenanceLog",
  "deviation", "capa", "changeControl",
  "document", "downloadRecord", "testReport",
  "approval", "auditLog", "message",
  "enquiry", "enquiryProduct", "enquiryTestRequest",
  "quotation", "quotationItem", "quotationHistory",
  "trf", "trfSample", "trfTestRequest", "trfDocument", "trfAuthorization", "trfReviewHistory",
  "sampleReceipt",
  "technicalReview", "technicalReviewHistory",
  "sampleRegistration",
  "testAllocation", "worksheet", "worksheetItem", "testResult",
  "technicalVerification", "draftReport", "draftReportItem", "qaReview",
  "reportRelease", "reportDelivery", "retentionRecord",
  "correction",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeMockPrisma(): any {
  const db: DB = buildSeedDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: Record<string, any> = {};
  for (const model of MODELS) client[model] = makeModel(db, model);
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(client);
  client.$disconnect = async () => {};
  return client;
}
