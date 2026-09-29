"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { ReceiptError } from "@/lib/receipts/access";
import { recordSampleReceipt, confirmTrfReceipt, addDiscrepancyReview } from "@/lib/receipts/service";
import type { SampleReceiptInput } from "@/lib/receipts/validation";

export interface ReceiptActionResult {
  ok: boolean;
  id?: string;
  status?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): ReceiptActionResult {
  if (e instanceof ReceiptError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[receipts action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function recordSampleReceiptAction(trfId: string, trfSampleId: string, input: SampleReceiptInput): Promise<ReceiptActionResult> {
  const user = await requireUser();
  try {
    const res = await recordSampleReceipt(actor(user), trfId, trfSampleId, input);
    revalidatePath("/receipts"); revalidatePath(`/receipts/${trfId}`);
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function confirmTrfReceiptAction(trfId: string): Promise<ReceiptActionResult> {
  const user = await requireUser();
  try {
    const res = await confirmTrfReceipt(actor(user), trfId);
    revalidatePath("/receipts"); revalidatePath(`/receipts/${trfId}`); revalidatePath(`/trfs/${trfId}`);
    return { ok: true, status: res.status };
  } catch (e) { return toResult(e); }
}

export async function addDiscrepancyReviewAction(trfId: string, trfSampleId: string, comment: string): Promise<ReceiptActionResult> {
  const user = await requireUser();
  try {
    await addDiscrepancyReview(actor(user), trfId, trfSampleId, comment);
    revalidatePath(`/receipts/${trfId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}
