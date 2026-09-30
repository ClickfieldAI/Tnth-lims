/**
 * In-memory mock data client — drop-in replacement for the real Prisma
 * client used everywhere else in the app (`import { prisma } from
 * "@/lib/prisma"`). No database, no network round-trip, no Supabase.
 *
 * Why: for demos / offline use, a hosted Postgres adds real cross-region
 * latency to every single page navigation. This keeps the exact same
 * `prisma.model.method(args)` call shape (see lib/mock/engine.ts) so none
 * of the ~40 call sites across actions/ and app/ needed to change — only
 * this file's export changed from a real PrismaClient to the mock.
 *
 * Data mutations (create/update/delete) persist for the lifetime of the
 * server process (same as any in-memory store) and reset on redeploy/cold
 * start — expected and fine for a demo; there is no real database to lose.
 */
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
] as const;

// Every model exposes the same method set (see lib/mock/engine.ts), so the
// client is typed as "each model name -> that shape" rather than against
// Prisma's generated (and now absent) schema types. Query results are still
// concrete object types (not `any`), so callers get normal array-callback
// inference (.filter/.map param types) without needing annotations.
type ModelClient = ReturnType<typeof makeModel>;
type MockPrismaClient = Record<(typeof MODELS)[number], ModelClient> & {
  $transaction: <T>(fn: (tx: MockPrismaClient) => Promise<T>) => Promise<T>;
  $disconnect: () => Promise<void>;
};

function createMockClient(db: DB): MockPrismaClient {
  const client = {} as MockPrismaClient;
  // Cast through `unknown` (not directly to Record<string, ModelClient>) —
  // $transaction/$disconnect intentionally don't match ModelClient's shape,
  // so a direct cast would be flagged as a non-overlapping conversion.
  const mutable = client as unknown as Record<string, unknown>;
  for (const model of MODELS) {
    mutable[model] = makeModel(db, model);
  }
  // No real transactions needed — everything is synchronous, in-process
  // JS object mutation, so just run the callback against the same client.
  mutable.$transaction = async (fn: (tx: MockPrismaClient) => Promise<unknown>) => fn(client);
  mutable.$disconnect = async () => {};
  return client;
}

const globalForMock = globalThis as unknown as { __mockDb?: DB; __mockPrisma?: MockPrismaClient };

// Cache both the raw data AND the client on globalThis so hot reload (dev)
// and warm serverless invocations (prod) reuse the same in-memory state
// instead of re-seeding on every request.
const db = globalForMock.__mockDb ?? buildSeedDb();
export const prisma = globalForMock.__mockPrisma ?? createMockClient(db);

globalForMock.__mockDb = db;
globalForMock.__mockPrisma = prisma;

export default prisma;
