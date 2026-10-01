"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { CorrectionError } from "@/lib/corrections/access";
import { requestCorrection, startCorrectionReview, approveCorrection, rejectCorrection, completeCorrection } from "@/lib/corrections/service";
import type { RequestCorrectionInput } from "@/lib/corrections/validation";

export interface CorrectionActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): CorrectionActionResult {
  if (e instanceof CorrectionError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[corrections action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function requestCorrectionAction(input: RequestCorrectionInput): Promise<CorrectionActionResult> {
  const user = await requireUser();
  try {
    await requestCorrection(actor(user), input);
    revalidatePath("/corrections");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function startCorrectionReviewAction(id: string): Promise<CorrectionActionResult> {
  const user = await requireUser();
  try {
    await startCorrectionReview(actor(user), id);
    revalidatePath("/corrections");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function approveCorrectionAction(id: string, comments?: string): Promise<CorrectionActionResult> {
  const user = await requireUser();
  try {
    await approveCorrection(actor(user), id, comments);
    revalidatePath("/corrections");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function rejectCorrectionAction(id: string, reason: string): Promise<CorrectionActionResult> {
  const user = await requireUser();
  try {
    await rejectCorrection(actor(user), id, reason);
    revalidatePath("/corrections");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function completeCorrectionAction(id: string): Promise<CorrectionActionResult> {
  const user = await requireUser();
  try {
    await completeCorrection(actor(user), id);
    revalidatePath("/corrections");
    return { ok: true };
  } catch (e) { return toResult(e); }
}
