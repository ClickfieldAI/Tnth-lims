"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { ReviewError } from "@/lib/reviews/access";
import {
  saveAssessment, acceptSampleReview, holdSampleReview, resumeSampleReview, rejectSampleReview, requestSampleClarification,
} from "@/lib/reviews/service";
import type { TechnicalAssessmentInput } from "@/lib/reviews/validation";

export interface ReviewActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): ReviewActionResult {
  if (e instanceof ReviewError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[reviews action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function saveAssessmentAction(trfId: string, trfSampleId: string, input: TechnicalAssessmentInput): Promise<ReviewActionResult> {
  const user = await requireUser();
  try {
    await saveAssessment(actor(user), trfId, trfSampleId, input);
    revalidatePath("/technical-review"); revalidatePath(`/technical-review/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function acceptSampleReviewAction(trfId: string, trfSampleId: string): Promise<ReviewActionResult> {
  const user = await requireUser();
  try {
    await acceptSampleReview(actor(user), trfId, trfSampleId);
    revalidatePath("/technical-review"); revalidatePath(`/technical-review/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function holdSampleReviewAction(trfId: string, trfSampleId: string, reason: string): Promise<ReviewActionResult> {
  const user = await requireUser();
  try {
    await holdSampleReview(actor(user), trfId, trfSampleId, reason);
    revalidatePath("/technical-review"); revalidatePath(`/technical-review/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function resumeSampleReviewAction(trfId: string, trfSampleId: string): Promise<ReviewActionResult> {
  const user = await requireUser();
  try {
    await resumeSampleReview(actor(user), trfId, trfSampleId);
    revalidatePath("/technical-review"); revalidatePath(`/technical-review/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function rejectSampleReviewAction(trfId: string, trfSampleId: string, reason: string): Promise<ReviewActionResult> {
  const user = await requireUser();
  try {
    await rejectSampleReview(actor(user), trfId, trfSampleId, reason);
    revalidatePath("/technical-review"); revalidatePath(`/technical-review/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function requestSampleClarificationAction(trfId: string, trfSampleId: string, comment: string): Promise<ReviewActionResult> {
  const user = await requireUser();
  try {
    await requestSampleClarification(actor(user), trfId, trfSampleId, comment);
    revalidatePath("/technical-review"); revalidatePath(`/technical-review/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}
