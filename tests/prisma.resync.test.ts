import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Regression test for the "data goes stale on Vercel" bug: a warm serverless
// instance used to hydrate from the store exactly once and then serve its own
// in-memory snapshot forever, so writes made by OTHER instances were never
// seen (e.g. save a quotation on instance A, create a TRF on instance B, and B
// still sees the pre-save quotation). lib/prisma.ts now re-pulls from the store
// before a read once a short trusted window (SYNC_TTL_MS = 750ms) lapses.

function dbString(users: Array<{ id: string; email: string }>): string {
  // Shape mirrors what persistence.saveDb writes: { result: "<json>" }.
  return JSON.stringify({ user: users });
}

describe("prisma mock re-syncs from the store (cross-instance freshness)", () => {
  const OLD_ENV = process.env;
  let stored: string; // the single Redis key's current value

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"] });
    process.env = { ...OLD_ENV, KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "test-token" };
    stored = dbString([{ id: "user_1", email: "a@tnth.io" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/set/")) {
          stored = JSON.parse(init!.body as string) as string; // persistence sends the json string as the POST body
          return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: stored }), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reflects a change another instance wrote once the sync window lapses", async () => {
    const { prisma } = await import("@/lib/prisma");

    // First read hydrates from the store: one user.
    expect(await prisma.user.findMany()).toHaveLength(1);

    // Another instance adds a user straight to the store.
    stored = dbString([
      { id: "user_1", email: "a@tnth.io" },
      { id: "user_2", email: "b@tnth.io" },
    ]);

    // Within the trusted window, this instance keeps serving its snapshot.
    expect(await prisma.user.findMany()).toHaveLength(1);

    // After the window lapses, the next read re-pulls and sees the new user.
    vi.setSystemTime(Date.now() + 3001);
    expect(await prisma.user.findMany()).toHaveLength(2);
  });
});
