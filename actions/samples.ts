"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { nextSampleCode, pad } from "@/lib/ids";
import { INDUSTRIES } from "@/lib/industries";

function testLabelFor(code: string): string {
  for (const industry of INDUSTRIES) {
    const sub = industry.subcategories.find((s) => s.slug === code);
    if (sub) return sub.name;
  }
  return code;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function createSample(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const client = await prisma.client.findFirst({ where: { id: String(formData.get("clientId") || "") } });
  if (!client) return { ok: false, error: "Select a valid client." };
  const productName = String(formData.get("productName") ?? "").trim();
  if (!productName) return { ok: false, error: "Product name is required." };

  const seq = (await prisma.sample.count()) + 1;
  const sampleCode = nextSampleCode(seq);

  const requestedTests = formData.getAll("requestedTests").map(String).filter(Boolean);
  if (!requestedTests.length) return { ok: false, error: "Select at least one test." };

  const batchNumber = String(formData.get("batchNumber") ?? "").trim() || null;

  const sample = await prisma.sample.create({
    data: {
      sampleCode,
      barcode: `BC-${sampleCode}`,
      clientId: client.id,
      productName,
      batchNumber,
      mfgDate: parseDate(formData.get("mfgDate")),
      expDate: parseDate(formData.get("expDate")),
      quantity: Number(formData.get("quantity")) || null,
      unit: String(formData.get("unit") ?? "g"),
      storageCondition: String(formData.get("storageCondition") ?? ""),
      storageLocation: String(formData.get("storageLocation") ?? ""),
      receivedDate: parseDate(formData.get("receivedDate")) ?? new Date(),
      priority: String(formData.get("priority") ?? "NORMAL"),
      status: "LOGGED",
      requestedTests,
      coOwner: "Sample Reception",
      createdById: user.id,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  await prisma.chainOfCustody.create({
    data: {
      sampleId: sample.id,
      toUserId: user.id,
      action: "RECEIVED",
      locationNote: String(formData.get("storageLocation") ?? "Reception"),
      note: `Registered by ${user.firstName} ${user.lastName}`,
    },
  });

  // Auto-create a trackable test request for each selected service so it
  // immediately shows up in the worksheet / QA review pipeline.
  const serviceLabel = String(formData.get("serviceLabel") ?? "").trim();
  const testSeqBase = await prisma.test.count();
  for (const [idx, code] of requestedTests.entries()) {
    const requestCode = `TST-${new Date().getFullYear()}-${pad(testSeqBase + idx + 1, 4)}`;
    await prisma.test.create({
      data: {
        requestCode,
        sampleId: sample.id,
        type: code,
        testName: `${serviceLabel || testLabelFor(code)} — ${productName}`,
        method: "Standard operating procedure — pending analyst confirmation",
        status: "ASSIGNED",
        priority: String(formData.get("priority") ?? "NORMAL"),
        dueDate: new Date(Date.now() + 6 * 86400000),
      },
    });
  }

  await logAudit(user.id, {
    action: "SAMPLE_CREATED",
    module: "SAMPLES",
    entityType: "Sample",
    entityId: sample.id,
    newValue: { code: sample.sampleCode, product: productName },
  });

  revalidatePath("/samples");
  return { ok: true, id: sample.id };
}

export async function assignSample(sampleId: string, analystId: string): Promise<ActionResult> {
  const user = await requireUser();
  const analyst = await prisma.user.findUnique({ where: { id: analystId }, include: { role: true } });
  if (!analyst) return { ok: false, error: "Analyst not found." };

  await prisma.sample.update({
    where: { id: sampleId },
    data: { assignedToId: analystId, status: "ASSIGNED" },
  });
  await prisma.chainOfCustody.create({
    data: { sampleId, fromUserId: user.id, toUserId: analystId, action: "TRANSFERRED", note: "Assigned for testing" },
  });
  await logAudit(user.id, {
    action: "SAMPLE_ASSIGNED", module: "SAMPLES", entityType: "Sample", entityId: sampleId,
    newValue: { assignedTo: `${analyst.firstName} ${analyst.lastName}` },
  });
  revalidatePath(`/samples/${sampleId}`);
  return { ok: true };
}

export async function advanceSampleStatus(sampleId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  const allowed = ["RECEIVED", "LOGGED", "ASSIGNED", "TESTING", "REVIEW", "APPROVED", "RELEASED", "ARCHIVED"];
  if (!allowed.includes(status)) return { ok: false, error: "Invalid status." };

  const sample = await prisma.sample.update({
    where: { id: sampleId },
    data: { status },
  });
  await logAudit(user.id, {
    action: "SAMPLE_STATUS_CHANGED", module: "SAMPLES", entityType: "Sample", entityId: sampleId,
    newValue: { status },
  });
  revalidatePath(`/samples/${sampleId}`);
  void sample;
  return { ok: true };
}