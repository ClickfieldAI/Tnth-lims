import { PrismaClient } from "@prisma/client";

/**
 * Production-safe Prisma client singleton.
 *
 * Serverless platforms (Vercel) keep functions warm across invocations, and
 * every cold start executes this module. Caching the client on `globalThis`
 * in ALL environments guarantees:
 *  - one Prisma connection pool per lambda instance (no connection storms
 *    against PostgreSQL / Supabase pooler),
 *  - no client re-instantiation between warm invocations.
 *
 * The generated client binds to the datasource declared in
 * prisma/schema.prisma (PostgreSQL in production). For zero-setup local
 * development a SQLite variant can be generated with `npm run db:local`.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV === "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;