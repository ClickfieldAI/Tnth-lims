"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { WorksheetError } from "@/lib/worksheets/access";
import {
  createWorksheet, updateWorksheetDraft, addTestToWorksheet, removeTestFromWorksheet, prepareWorksheet, assignWorksheet,
} from "@/lib/worksheets/service";
import type { CreateWorksheetInput } from "@/lib/worksheets/validation";

export interface WorksheetActionResult {
  ok: boolean;
  id?: string;
  worksheetCode?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): WorksheetActionResult {
  if (e instanceof WorksheetError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[worksheets action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createWorksheetAction(input: CreateWorksheetInput): Promise<WorksheetActionResult> {
  const user = await requireUser();
  try {
    const res = await createWorksheet(actor(user), input);
    revalidatePath("/worksheets");
    return { ok: true, id: res.id, worksheetCode: res.worksheetCode };
  } catch (e) { return toResult(e); }
}

export async function updateWorksheetDraftAction(id: string, input: { notes?: string; dueDate?: string; instrumentId?: string }): Promise<WorksheetActionResult> {
  const user = await requireUser();
  try {
    await updateWorksheetDraft(actor(user), id, input);
    revalidatePath(`/worksheets/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function addTestToWorksheetAction(worksheetId: string, testAllocationId: string): Promise<WorksheetActionResult> {
  const user = await requireUser();
  try {
    await addTestToWorksheet(actor(user), worksheetId, testAllocationId);
    revalidatePath(`/worksheets/${worksheetId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function removeTestFromWorksheetAction(worksheetId: string, testAllocationId: string): Promise<WorksheetActionResult> {
  const user = await requireUser();
  try {
    await removeTestFromWorksheet(actor(user), worksheetId, testAllocationId);
    revalidatePath(`/worksheets/${worksheetId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function prepareWorksheetAction(id: string): Promise<WorksheetActionResult> {
  const user = await requireUser();
  try {
    await prepareWorksheet(actor(user), id);
    revalidatePath("/worksheets"); revalidatePath(`/worksheets/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function assignWorksheetAction(id: string): Promise<WorksheetActionResult> {
  const user = await requireUser();
  try {
    await assignWorksheet(actor(user), id);
    revalidatePath("/worksheets"); revalidatePath(`/worksheets/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}
