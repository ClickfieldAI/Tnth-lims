"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { QaReviewError } from "@/lib/qa-review/access";
import { approveReport, returnReport } from "@/lib/qa-review/service";

export interface QaReviewActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): QaReviewActionResult {
  if (e instanceof QaReviewError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[qa-review action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function approveReportAction(draftReportId: string, comments?: string): Promise<QaReviewActionResult> {
  const user = await requireUser();
  try {
    await approveReport(actor(user), draftReportId, comments);
    revalidatePath("/qa-review"); revalidatePath(`/reports/draft/${draftReportId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function returnReportAction(draftReportId: string, reason: string): Promise<QaReviewActionResult> {
  const user = await requireUser();
  try {
    await returnReport(actor(user), draftReportId, reason);
    revalidatePath("/qa-review"); revalidatePath(`/reports/draft/${draftReportId}`); revalidatePath("/reports/draft");
    return { ok: true };
  } catch (e) { return toResult(e); }
}
