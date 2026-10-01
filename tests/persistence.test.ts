import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("persistence (Upstash REST) round-trip", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV, KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "test-token" };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
  });

  it("is a no-op when env vars are not set", async () => {
    process.env.KV_REST_API_URL = "";
    process.env.KV_REST_API_TOKEN = "";
    const { isPersistenceConfigured, loadDb, saveDb } = await import("@/lib/mock/persistence");
    expect(isPersistenceConfigured()).toBe(false);
    expect(await loadDb()).toBeNull();
    await expect(saveDb({ foo: [] })).resolves.toBeUndefined();
  });

  it("round-trips Date fields through JSON serialization without turning them into strings", async () => {
    let stored: string | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/set/")) {
        stored = init?.body as string;
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: stored }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { loadDb, saveDb } = await import("@/lib/mock/persistence");
    const now = new Date("2026-10-01T12:00:00.000Z");
    const db = {
      correction: [{ id: "correction_1", status: "COMPLETED", requestedAt: now, reviewedAt: null, createdAt: now }],
    };

    await saveDb(db);
    expect(stored).toBeTruthy();

    const loaded = await loadDb();
    expect(loaded).not.toBeNull();
    const row = loaded!.correction[0];
    expect(row.requestedAt).toBeInstanceOf(Date);
    expect(row.requestedAt.getTime()).toBe(now.getTime());
    expect(row.reviewedAt).toBeNull();
    expect(row.status).toBe("COMPLETED");
  });

  it("returns null when nothing has been stored yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: null }), { status: 200 })));
    const { loadDb } = await import("@/lib/mock/persistence");
    expect(await loadDb()).toBeNull();
  });
});
