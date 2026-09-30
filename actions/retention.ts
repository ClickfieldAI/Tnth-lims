"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { RetentionError } from "@/lib/retention/access";
import { extendRetention, disposeSample } from "@/lib/retention/service";

export interface RetentionActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): RetentionActionResult {
  if (e instanceof RetentionError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[retention action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function extendRetentionAction(id: string, newExpiryDate: string, reason?: string): Promise<RetentionActionResult> {
  const user = await requireUser();
  try {
    await extendRetention(actor(user), id, newExpiryDate, reason);
    revalidatePath("/retention");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function disposeSampleAction(id: string, reason: string): Promise<RetentionActionResult> {
  const user = await requireUser();
  try {
    await disposeSample(actor(user), id, reason);
    revalidatePath("/retention");
    return { ok: true };
  } catch (e) { return toResult(e); }
}
