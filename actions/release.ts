"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { ReleaseError } from "@/lib/release/access";
import { releaseReport, returnReportFromRelease } from "@/lib/release/service";

export interface ReleaseActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): ReleaseActionResult {
  if (e instanceof ReleaseError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[release action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function releaseReportAction(draftReportId: string, comments?: string): Promise<ReleaseActionResult> {
  const user = await requireUser();
  try {
    await releaseReport(actor(user), draftReportId, comments);
    revalidatePath("/report-release"); revalidatePath(`/reports/draft/${draftReportId}`); revalidatePath("/report-delivery"); revalidatePath("/retention");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function returnReportFromReleaseAction(draftReportId: string, reason: string): Promise<ReleaseActionResult> {
  const user = await requireUser();
  try {
    await returnReportFromRelease(actor(user), draftReportId, reason);
    revalidatePath("/report-release"); revalidatePath(`/reports/draft/${draftReportId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}
