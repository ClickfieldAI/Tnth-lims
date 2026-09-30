"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { ResultEntryError } from "@/lib/result-entry/access";
import { saveResult, completeResult, correctResult } from "@/lib/result-entry/service";
import type { ResultEntryInput } from "@/lib/result-entry/validation";

export interface ResultEntryActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): ResultEntryActionResult {
  if (e instanceof ResultEntryError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[result-entry action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function saveResultAction(testAllocationId: string, input: ResultEntryInput): Promise<ResultEntryActionResult> {
  const user = await requireUser();
  try {
    const res = await saveResult(actor(user), testAllocationId, input);
    revalidatePath("/testing");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function completeResultAction(testAllocationId: string): Promise<ResultEntryActionResult> {
  const user = await requireUser();
  try {
    await completeResult(actor(user), testAllocationId);
    revalidatePath("/testing");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function correctResultAction(testAllocationId: string, input: ResultEntryInput, reason: string): Promise<ResultEntryActionResult> {
  const user = await requireUser();
  try {
    await correctResult(actor(user), testAllocationId, input, reason);
    revalidatePath("/testing");
    return { ok: true };
  } catch (e) { return toResult(e); }
}
