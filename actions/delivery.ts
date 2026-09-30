"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { DeliveryError } from "@/lib/delivery/access";
import { createDelivery, markDeliveryFailed, retryDelivery } from "@/lib/delivery/service";
import type { CreateDeliveryInput } from "@/lib/delivery/validation";

export interface DeliveryActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): DeliveryActionResult {
  if (e instanceof DeliveryError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[delivery action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createDeliveryAction(draftReportId: string, input: CreateDeliveryInput): Promise<DeliveryActionResult> {
  const user = await requireUser();
  try {
    const res = await createDelivery(actor(user), draftReportId, input);
    revalidatePath("/report-delivery");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}

export async function markDeliveryFailedAction(deliveryId: string, reason: string): Promise<DeliveryActionResult> {
  const user = await requireUser();
  try {
    await markDeliveryFailed(actor(user), deliveryId, reason);
    revalidatePath("/report-delivery");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function retryDeliveryAction(draftReportId: string, input: CreateDeliveryInput): Promise<DeliveryActionResult> {
  const user = await requireUser();
  try {
    const res = await retryDelivery(actor(user), draftReportId, input);
    revalidatePath("/report-delivery");
    return { ok: true, id: res.id };
  } catch (e) { return toResult(e); }
}
