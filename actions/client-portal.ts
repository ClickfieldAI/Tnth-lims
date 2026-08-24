"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { nextSampleCode } from "@/lib/ids";

export interface ClientActionResult {
  ok: boolean;
  error?: string;
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// Client submits a new sample through the portal.
export async function createClientSample(formData: FormData): Promise<ClientActionResult> {
  const user = await requireRole("CLIENT");
  if (!user.clientId) return { ok: false, error: "No client company linked to this account." };

  const productName = String(formData.get("productName") ?? "").trim();
  if (!productName) return { ok: false, error: "Product name is required." };

  const requestedTests = formData.getAll("requestedTests").map(String).filter(Boolean);
  if (!requestedTests.length) return { ok: false, error: "Select at least one test." };

  const seq = (await prisma.sample.count()) + 1;
  const sampleCode = nextSampleCode(seq);

  const sample = await prisma.sample.create({
    data: {
      sampleCode,
      barcode: `BC-${sampleCode}`,
      clientId: user.clientId,
      createdById: user.id,
      productName,
      batchNumber: String(formData.get("batchNumber") ?? "").trim() || null,
      mfgDate: parseDate(formData.get("mfgDate")),
      expDate: parseDate(formData.get("expDate")),
      quantity: Number(formData.get("quantity")) || null,
      unit: String(formData.get("unit") ?? "g"),
      storageCondition: String(formData.get("storageCondition") ?? ""),
      receivedDate: new Date(),
      status: "RECEIVED",
      priority: "NORMAL",
      requestedTests,
      coOwner: "Client submission",
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  await prisma.chainOfCustody.create({
    data: {
      sampleId: sample.id,
      toUserId: user.id,
      action: "RECEIVED",
      locationNote: "Client portal submission",
      note: `Submitted via client portal by ${user.firstName} ${user.lastName}`,
    },
  });

  await logAudit(user.id, {
    action: "SAMPLE_CREATED", module: "CLIENT_PORTAL",
    entityType: "Sample", entityId: sample.id,
    newValue: { code: sampleCode, product: productName },
  });

  revalidatePath("/client/samples");
  return { ok: true };
}

// Client sends a message to the laboratory.
export async function sendClientMessage(formData: FormData): Promise<ClientActionResult> {
  const user = await requireRole("CLIENT");
  if (!user.clientId) return { ok: false, error: "No client company linked." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Message cannot be empty." };

  await prisma.message.create({
    data: {
      clientId: user.clientId,
      authorId: user.id,
      body,
      fromClient: true,
    },
  });

  revalidatePath("/client/messages");
  return { ok: true };
}