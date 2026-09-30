"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { VerificationError } from "@/lib/verification/access";
import { verifyResult, returnResult } from "@/lib/verification/service";

export interface VerificationActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): VerificationActionResult {
  if (e instanceof VerificationError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[verification action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function verifyResultAction(testResultId: string, comments?: string): Promise<VerificationActionResult> {
  const user = await requireUser();
  try {
    const res = await verifyResult(actor(user), testResultId, comments);
    revalidatePath("/technical-verification");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function returnResultAction(testResultId: string, reason: string): Promise<VerificationActionResult> {
  const user = await requireUser();
  try {
    const res = await returnResult(actor(user), testResultId, reason);
    revalidatePath("/technical-verification");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}
