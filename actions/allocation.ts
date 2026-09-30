"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { AllocationError } from "@/lib/allocation/access";
import { allocateTest, reassignTest } from "@/lib/allocation/service";
import type { AllocateTestInput } from "@/lib/allocation/validation";

export interface AllocationActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): AllocationActionResult {
  if (e instanceof AllocationError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[allocation action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function allocateTestAction(trfTestRequestId: string, input: AllocateTestInput): Promise<AllocationActionResult> {
  const user = await requireUser();
  try {
    const res = await allocateTest(actor(user), trfTestRequestId, input);
    revalidatePath("/test-allocation");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function reassignTestAction(trfTestRequestId: string, input: AllocateTestInput): Promise<AllocationActionResult> {
  const user = await requireUser();
  try {
    const res = await reassignTest(actor(user), trfTestRequestId, input);
    revalidatePath("/test-allocation");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}
