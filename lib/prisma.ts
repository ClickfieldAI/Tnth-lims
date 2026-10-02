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
 * server process (same as any in-memory store). On Vercel, where each
 * request can land on a separate, memory-isolated instance, that alone
 * isn't enough — see lib/mock/persistence.ts, which optionally backs this
 * same in-memory dataset with Redis so it survives across instances/cold
 * starts. Inert without KV_REST_API_URL/KV_REST_API_TOKEN set (e.g. local
 * dev, tests), in which case this behaves exactly as the comment above
 * originally described: resets on every process restart.
 */
import { makeModel, resyncIdCounters, type DB } from "./mock/engine";
import { buildSeedDb } from "./mock/seed-data";
import { isPersistenceConfigured, loadDb, saveDb } from "./mock/persistence";

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

// Write methods that change stored data — after any of these runs, the
// whole dataset is persisted (see ensureHydrated/schedulePersist below) so
// a different serverless instance picks up the change. Read methods still
// go through ensureHydrated first, so a cold instance restores state
// before serving its first query.
const WRITE_METHODS = new Set(["create", "update", "updateMany", "upsert", "delete", "deleteMany"]);

function createMockClient(db: DB, onCall: () => Promise<unknown>, onWrite: () => Promise<void>): MockPrismaClient {
  const client = {} as MockPrismaClient;
  // Cast through `unknown` (not directly to Record<string, ModelClient>) —
  // $transaction/$disconnect intentionally don't match ModelClient's shape,
  // so a direct cast would be flagged as a non-overlapping conversion.
  const mutable = client as unknown as Record<string, unknown>;
  for (const model of MODELS) {
    const base = makeModel(db, model) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const wrapped: Record<string, (...a: unknown[]) => Promise<unknown>> = {};
    for (const method of Object.keys(base)) {
      wrapped[method] = async (...args: unknown[]) => {
        await onCall();
        const result = await base[method](...args);
        if (WRITE_METHODS.has(method)) await onWrite();
        return result;
      };
    }
    mutable[model] = wrapped;
  }
  // No real transactions needed — everything is synchronous, in-process
  // JS object mutation, so just run the callback against the same client.
  mutable.$transaction = async (fn: (tx: MockPrismaClient) => Promise<unknown>) => fn(client);
  mutable.$disconnect = async () => {};
  return client;
}

type GlobalMock = {
  __mockDb?: DB;
  __mockPrisma?: MockPrismaClient;
  __mockHydrate?: Promise<boolean>;
  __mockDemoSeedNeeded?: Promise<boolean>;
};
const globalForMock = globalThis as unknown as GlobalMock;

// Cache both the raw data AND the client on globalThis so hot reload (dev)
// and warm serverless invocations (prod) reuse the same in-memory state
// instead of re-seeding on every request.
const db = globalForMock.__mockDb ?? buildSeedDb();
globalForMock.__mockDb = db;

function replaceDbInPlace(loaded: DB): void {
  for (const key of Object.keys(db)) {
    db[key].length = 0;
    db[key].push(...(loaded[key] ?? []));
  }
  resyncIdCounters(db);
}

// First-touch hydration: restore existing data from the persistence backend,
// or (nothing stored yet) seed fresh and save it. Runs exactly once per
// process. Inert when no backend is configured — e.g. local dev, vitest.
// Resolves to whether this process had to seed fresh (true) vs restore
// existing data (false), so instrumentation.ts runs the one-time demo-workflow
// seed only on a genuinely empty store.
function ensureHydrated(): Promise<boolean> {
  if (!globalForMock.__mockHydrate) {
    globalForMock.__mockHydrate = (async () => {
      const loaded = await loadDb();
      if (loaded) {
        replaceDbInPlace(loaded);
        lastSyncedAt = Date.now();
        return false;
      }
      await saveDb(db);
      lastSyncedAt = Date.now();
      return true;
    })();
  }
  return globalForMock.__mockHydrate;
}

// How long (ms) a freshly loaded snapshot is trusted before the next read
// re-pulls from the store. Short enough that a write made by another
// serverless instance becomes visible almost immediately; long enough that
// the burst of queries in a single page render shares one load instead of
// fetching from Redis on every call.
const SYNC_TTL_MS = 750;
let lastSyncedAt = 0;
let inFlightSync: Promise<void> | null = null;

// Called before EVERY query (read or write). Guarantees first-touch hydration,
// then keeps this instance's in-memory copy fresh by re-pulling from the store
// once the trusted window lapses. Without this, a warm serverless instance
// keeps serving its own snapshot and never sees writes made by other instances
// — e.g. "save a quotation on instance A, create a TRF on instance B, and B
// still sees the old quotation" (the data-goes-stale bug). Because writes also
// go through here first, each mutation is applied on top of the latest stored
// state (read-modify-write), not a stale copy. Inert when no backend is
// configured: it just does the one-time hydrate and returns.
async function syncFromStore(): Promise<void> {
  await ensureHydrated();
  if (!isPersistenceConfigured()) return;
  if (Date.now() - lastSyncedAt < SYNC_TTL_MS) return;
  if (!inFlightSync) {
    inFlightSync = (async () => {
      try {
        const loaded = await loadDb();
        if (loaded) replaceDbInPlace(loaded);
        lastSyncedAt = Date.now();
      } finally {
        inFlightSync = null;
      }
    })();
  }
  return inFlightSync;
}

let persisting: Promise<void> = Promise.resolve();
function schedulePersist(): Promise<void> {
  // Chain saves so concurrent writes within one request don't race each
  // other's fetch calls, and awaited directly by the caller (no timer)
  // since a serverless function can be frozen immediately after its
  // response is sent — a deferred save could otherwise be lost. After a
  // successful save our in-memory copy equals the store, so refresh the
  // trusted window to avoid an immediate redundant re-pull.
  persisting = persisting.then(() => saveDb(db), () => saveDb(db));
  return persisting
    .then(() => { lastSyncedAt = Date.now(); })
    .catch((e) => { console.error("[persistence] save failed", e); });
}

export const prisma = globalForMock.__mockPrisma ?? createMockClient(db, syncFromStore, schedulePersist);
globalForMock.__mockPrisma = prisma;

/** True if this process had no persisted data and seeded fresh — used by instrumentation.ts to run the demo workflow seed only once, not on every cold start. */
export const demoSeedNeeded: Promise<boolean> = globalForMock.__mockDemoSeedNeeded ?? ensureHydrated();
globalForMock.__mockDemoSeedNeeded = demoSeedNeeded;

export default prisma;
