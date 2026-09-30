"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { DraftReportError } from "@/lib/reports/access";
import { createDraftReport, generateDraftReport, submitDraftReportForQa, createReportRevision, getDraftReportPdfData } from "@/lib/reports/service";
import type { CreateDraftReportInput } from "@/lib/reports/validation";
import type { TnthReportData } from "@/lib/tnth-report";

export interface DraftReportActionResult {
  ok: boolean;
  id?: string;
  reportCode?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): DraftReportActionResult {
  if (e instanceof DraftReportError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[reports-draft action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createDraftReportAction(input: CreateDraftReportInput): Promise<DraftReportActionResult> {
  const user = await requireUser();
  try {
    const res = await createDraftReport(actor(user), input);
    revalidatePath("/reports/draft");
    return { ok: true, id: res.id, reportCode: res.reportCode };
  } catch (e) { return toResult(e); }
}

export async function generateDraftReportAction(id: string): Promise<DraftReportActionResult> {
  const user = await requireUser();
  try {
    await generateDraftReport(actor(user), id);
    revalidatePath("/reports/draft"); revalidatePath(`/reports/draft/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function submitDraftReportForQaAction(id: string): Promise<DraftReportActionResult> {
  const user = await requireUser();
  try {
    await submitDraftReportForQa(actor(user), id);
    revalidatePath("/reports/draft"); revalidatePath(`/reports/draft/${id}`); revalidatePath("/qa-review");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function createReportRevisionAction(id: string, reason: string): Promise<DraftReportActionResult> {
  const user = await requireUser();
  try {
    const res = await createReportRevision(actor(user), id, reason);
    revalidatePath("/reports/draft");
    return { ok: true, id: res.id, reportCode: res.reportCode };
  } catch (e) { return toResult(e); }
}

export async function getDraftReportPdfDataAction(id: string): Promise<TnthReportData | null> {
  const user = await requireUser();
  try {
    return await getDraftReportPdfData(actor(user), id);
  } catch {
    return null;
  }
}
