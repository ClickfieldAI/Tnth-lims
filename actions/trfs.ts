"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { TrfError } from "@/lib/trfs/access";
import {
  createTrfDraft, updateTrfDraft, addTrfSample, updateTrfSample, removeTrfSample,
  addTrfDocument, removeTrfDocument, setTrfAuthorization, submitTrf,
  startTrfReview, acceptTrf, holdTrf, resumeTrfReview, rejectTrf, requestTrfClarification,
  type TrfStep4Fields,
} from "@/lib/trfs/service";
import type { TrfInput, TrfSampleInput, TrfAuthorizationInput, TrfDocumentMeta } from "@/lib/trfs/validation";

export interface TrfActionResult {
  ok: boolean;
  id?: string;
  code?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): TrfActionResult {
  if (e instanceof TrfError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[trfs action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createTrfDraftAction(input: Pick<TrfInput, "customerId" | "quotationId" | "poNumber">): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    const res = await createTrfDraft(actor(user), input);
    revalidatePath("/trfs");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function updateTrfDraftAction(id: string, fields: TrfStep4Fields): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await updateTrfDraft(actor(user), id, fields);
    revalidatePath(`/trfs/${id}`);
    return { ok: true, id };
  } catch (e) { return toResult(e); }
}

export async function addTrfSampleAction(trfId: string, input: TrfSampleInput): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    const res = await addTrfSample(actor(user), trfId, input);
    revalidatePath(`/trfs/${trfId}`);
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function updateTrfSampleAction(trfId: string, sampleId: string, input: TrfSampleInput): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await updateTrfSample(actor(user), trfId, sampleId, input);
    revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function removeTrfSampleAction(trfId: string, sampleId: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await removeTrfSample(actor(user), trfId, sampleId);
    revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function addTrfDocumentAction(trfId: string, meta: TrfDocumentMeta): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await addTrfDocument(actor(user), trfId, meta);
    revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function removeTrfDocumentAction(trfId: string, documentId: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await removeTrfDocument(actor(user), trfId, documentId);
    revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function setTrfAuthorizationAction(trfId: string, input: TrfAuthorizationInput): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await setTrfAuthorization(actor(user), trfId, input);
    revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function submitTrfAction(trfId: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    const res = await submitTrf(actor(user), trfId);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) { return toResult(e); }
}

export async function startTrfReviewAction(trfId: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await startTrfReview(actor(user), trfId);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function acceptTrfAction(trfId: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await acceptTrf(actor(user), trfId);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function holdTrfAction(trfId: string, reason: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await holdTrf(actor(user), trfId, reason);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function resumeTrfReviewAction(trfId: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await resumeTrfReview(actor(user), trfId);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function rejectTrfAction(trfId: string, reason: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await rejectTrf(actor(user), trfId, reason);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function requestTrfClarificationAction(trfId: string, comment: string): Promise<TrfActionResult> {
  const user = await requireUser();
  try {
    await requestTrfClarification(actor(user), trfId, comment);
    revalidatePath("/trfs"); revalidatePath(`/trfs/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}
