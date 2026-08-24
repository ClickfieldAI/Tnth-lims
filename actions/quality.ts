"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/actions/samples";
import { nextDeviationCode, nextCapaCode, nextChangeControlCode } from "@/lib/ids";

export async function createDeviation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { ok: false, error: "Description is required." };

  const seq = (await prisma.deviation.count()) + 1;
  const dev = await prisma.deviation.create({
    data: {
      deviationId: nextDeviationCode(seq),
      description,
      category: String(formData.get("category") ?? "ANALYTICAL"),
      impactLevel: String(formData.get("impactLevel") ?? "MINOR"),
      status: "OPEN",
      reportedById: user.id,
    },
  });

  await logAudit(user.id, {
    action: "DEVIATION_OPENED", module: "QUALITY",
    entityType: "Deviation", entityId: dev.id,
    newValue: { id: dev.deviationId },
  });
  revalidatePath("/quality/deviations");
  return { ok: true };
}

export async function updateDeviationStatus(devId: string, status: string, rootCause?: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.deviation.update({
    where: { id: devId },
    data: {
      status,
      ...(rootCause ? { rootCause } : {}),
      ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
  await logAudit(user.id, {
    action: "DEVIATION_UPDATED", module: "QUALITY",
    entityType: "Deviation", entityId: devId,
    newValue: { status },
  });
  revalidatePath("/quality/deviations");
  return { ok: true };
}

export async function createCapa(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };

  const dueRaw = String(formData.get("dueDate") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "") || null;

  const seq = (await prisma.capa.count()) + 1;
  const capa = await prisma.capa.create({
    data: {
      capaId: nextCapaCode(seq),
      title,
      type: String(formData.get("type") ?? "CORRECTIVE"),
      description: String(formData.get("description") ?? "") || null,
      action: String(formData.get("action") ?? "") || null,
      ownerId,
      dueDate: dueRaw ? new Date(dueRaw) : null,
      status: "OPEN",
    },
  });

  await logAudit(user.id, {
    action: "CAPA_CREATED", module: "QUALITY",
    entityType: "Capa", entityId: capa.id,
    newValue: { id: capa.capaId, title },
  });
  revalidatePath("/quality/capa");
  return { ok: true };
}

export async function updateCapaStatus(capaId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.capa.update({
    where: { id: capaId },
    data: {
      status,
      ...(status === "CLOSED" || status === "VERIFIED" ? { closedAt: new Date(), closedById: user.id } : {}),
    },
  });
  await logAudit(user.id, {
    action: "CAPA_UPDATED", module: "QUALITY", entityType: "Capa", entityId: capaId,
    newValue: { status },
  });
  revalidatePath("/quality/capa");
  return { ok: true };
}

export async function createChangeControl(formData: FormData): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "QA");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };

  const seq = (await prisma.changeControl.count()) + 1;
  const cc = await prisma.changeControl.create({
    data: {
      ccId: nextChangeControlCode(seq),
      title,
      category: String(formData.get("category") ?? "METHOD"),
      description: String(formData.get("description") ?? "") || null,
      justification: String(formData.get("justification") ?? "") || null,
      proposedBy: `${user.firstName} ${user.lastName}`,
      impactAnalysis: { risk: String(formData.get("risk") ?? "low"), areas: formData.getAll("impactArea").map(String) },
      status: "SUBMITTED",
    },
  });

  await logAudit(user.id, {
    action: "CHANGE_CONTROL_RAISED", module: "QUALITY",
    entityType: "ChangeControl", entityId: cc.id,
    newValue: { id: cc.ccId, title },
  });
  revalidatePath("/quality/change-control");
  return { ok: true };
}

export async function decideChangeControl(ccId: string, decision: "APPROVED" | "REJECTED" | "IMPLEMENTED"): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "QA");
  await prisma.changeControl.update({
    where: { id: ccId },
    data: {
      status: decision,
      approvedById: user.id,
      decidedAt: new Date(),
    },
  });
  await logAudit(user.id, {
    action: "CHANGE_CONTROL_DECIDED", module: "QUALITY",
    entityType: "ChangeControl", entityId: ccId,
    newValue: { decision },
  });
  revalidatePath("/quality/change-control");
  return { ok: true };
}