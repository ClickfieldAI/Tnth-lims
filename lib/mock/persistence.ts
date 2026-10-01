// Optional persistence for the in-memory mock DB, backed by Upstash Redis's
// REST API (plain fetch — no SDK dependency). Lets the mock dataset survive
// across separate Vercel serverless invocations, which otherwise each get
// their own isolated memory and would reset on every cold start.
//
// Inert by default: if KV_REST_API_URL / KV_REST_API_TOKEN aren't set (e.g.
// local dev, vitest), every function here is a no-op and lib/prisma.ts
// behaves exactly as before — nothing about local dev or the test suite
// changes. These env var names match what Vercel's "Upstash for Redis"
// storage integration auto-injects, so adding that integration from the
// Storage tab needs no extra configuration.
import type { DB } from "./engine";

const KEY = "tnth-lims:db";

function config() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function isPersistenceConfigured(): boolean {
  return config() !== null;
}

// Date objects don't survive JSON.stringify as themselves (they become ISO
// strings with no way to tell them apart from a real string field), so tag
// them going out and restore them coming back in. `this[key]` inside the
// replacer is the ORIGINAL value before Date.prototype.toJSON() runs, so
// this reliably detects every Date field regardless of its name.
function replacer(this: Record<string, unknown>, key: string, value: unknown) {
  const original = this[key];
  if (original instanceof Date) return { __type: "Date", iso: original.toISOString() };
  return value;
}

function reviver(_key: string, value: unknown) {
  if (value && typeof value === "object" && (value as { __type?: string }).__type === "Date") {
    return new Date((value as { iso: string }).iso);
  }
  return value;
}

export async function loadDb(): Promise<DB | null> {
  const c = config();
  if (!c) return null;
  const res = await fetch(`${c.url}/get/${encodeURIComponent(KEY)}`, {
    headers: { Authorization: `Bearer ${c.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`[persistence] load failed: ${res.status} ${await res.text().catch(() => "")}`);
  const { result } = (await res.json()) as { result: string | null };
  if (!result) return null;
  return JSON.parse(result, reviver) as DB;
}

export async function saveDb(db: DB): Promise<void> {
  const c = config();
  if (!c) return;
  const body = JSON.stringify(db, replacer);
  const res = await fetch(`${c.url}/set/${encodeURIComponent(KEY)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) throw new Error(`[persistence] save failed: ${res.status} ${await res.text().catch(() => "")}`);
}
