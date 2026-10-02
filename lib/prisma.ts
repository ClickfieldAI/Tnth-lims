// Database client. The app uses the real Prisma client (PostgreSQL / Supabase);
// the test suite (vitest) uses the in-memory mock so the ~260 service tests stay
// fast, isolated and DB-free. Either way call sites import `{ prisma }` and use
// the same Prisma query API. Moving off the former in-memory store fixes the
// serverless staleness/slowness on Vercel (each request had its own memory).
import { PrismaClient } from "@prisma/client";
import { makeMockPrisma } from "./prisma.mock";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function realPrisma(): PrismaClient {
  return (
    globalForPrisma.__prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = process.env.VITEST ? makeMockPrisma() : realPrisma();

if (process.env.NODE_ENV !== "production" && !process.env.VITEST) {
  globalForPrisma.__prisma = prisma as PrismaClient;
}

// The database is already seeded (data loaded directly into Postgres), so the
// one-time demo-workflow seed in instrumentation.ts must never run. Kept as an
// export for compatibility with its existing importers.
export const demoSeedNeeded: Promise<boolean> = Promise.resolve(false);

export default prisma;
