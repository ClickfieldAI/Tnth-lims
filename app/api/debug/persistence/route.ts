// Temporary diagnostic route for debugging the Vercel + Redis persistence
// setup — gated behind an authenticated session (no RBAC weakening: any
// logged-in internal user can see this, same as any other dashboard page).
// Safe to delete once persistence is confirmed working.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { isPersistenceConfigured } from "@/lib/mock/persistence";
import { prisma, demoSeedNeeded } from "@/lib/prisma";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Not authenticated — log in first, then revisit this URL." }, { status: 401 });
  }

  const envPresent = { KV_REST_API_URL: !!process.env.KV_REST_API_URL, KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN };
  const configured = isPersistenceConfigured();

  let enquiryCount: number | null = null;
  let readError: string | null = null;
  try {
    enquiryCount = await prisma.enquiry.count();
  } catch (e) {
    readError = e instanceof Error ? e.message : String(e);
  }

  let freshlySeeded: boolean | string = "pending";
  try {
    freshlySeeded = await demoSeedNeeded;
  } catch (e) {
    freshlySeeded = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  let writeProbe: string | null = null;
  try {
    const marker = await prisma.auditLog.create({
      data: { actorId: null, action: "DEBUG_PERSISTENCE_PROBE", module: "debug", entityType: null, entityId: null, oldValue: null, newValue: { at: new Date().toISOString() }, ip: null, userAgent: null, createdAt: new Date() },
    });
    writeProbe = `ok (created ${marker.id})`;
  } catch (e) {
    writeProbe = `failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    envPresent,
    persistenceConfigured: configured,
    enquiryCount,
    readError,
    freshlySeeded,
    writeProbe,
    note: "If persistenceConfigured is false, env vars aren't visible to this function. If enquiryCount keeps resetting to the same low number across requests/refreshes, writes aren't reaching Redis — check readError/writeProbe. If freshlySeeded is always true, hydration never finds previously saved data.",
  });
}
