"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { signApproval, SignatureError } from "@/lib/esign";
import type { ActionResult } from "@/actions/samples";
import { nextDocCode } from "@/lib/ids";

export async function createDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };

  const seq = (await prisma.document.count()) + 1;
  const doc = await prisma.document.create({
    data: {
      docCode: nextDocCode(seq),
      title,
      category: String(formData.get("category") ?? "SOP"),
      version: String(formData.get("version") ?? "1.0"),
      filePath: String(formData.get("filePath") ?? "") || null,
      status: "DRAFT",
      ownerId: user.id,
    },
  });

  await logAudit(user.id, {
    action: "DOCUMENT_CREATED", module: "DOCUMENTS",
    entityType: "Document", entityId: doc.id,
    newValue: { id: doc.docCode, title },
  });
  revalidatePath("/documents");
  return { ok: true };
}

export async function submitDocumentForReview(docId: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.document.update({ where: { id: docId }, data: { status: "UNDER_REVIEW" } });
  await logAudit(user.id, {
    action: "DOCUMENT_SUBMITTED", module: "DOCUMENTS", entityType: "Document", entityId: docId,
    newValue: { status: "UNDER_REVIEW" },
  });
  revalidatePath("/documents");
  return { ok: true };
}

// QA/Admin sign-off — the actual "digital approval" the document page claims to have.
export async function decideDocument(
  docId: string,
  decision: "APPROVED" | "DRAFT",
  password: string,
  comment?: string,
): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "QA", "MANAGER");
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return { ok: false, error: "Document not found." };

  try {
    const approval = await signApproval(user, password, {
      referenceType: "DOCUMENT",
      referenceId: docId,
      action: decision,
      meaning:
        decision === "APPROVED"
          ? `I approve document ${doc.docCode} v${doc.version} as effective`
          : `I am returning document ${doc.docCode} to draft`,
      comment,
      recordSnapshot: { docCode: doc.docCode, version: doc.version, title: doc.title },
    });

    await prisma.document.update({
      where: { id: docId },
      data:
        decision === "APPROVED"
          ? { status: "APPROVED", approvedByUserId: user.id, approvedAt: new Date(), digitalSignature: approval.id }
          : { status: "DRAFT", approvedByUserId: null, approvedAt: null, digitalSignature: null },
    });
  } catch (e) {
    if (e instanceof SignatureError) return { ok: false, error: e.message };
    throw e;
  }

  await logAudit(user.id, {
    action: decision === "APPROVED" ? "DOCUMENT_APPROVED" : "DOCUMENT_RETURNED",
    module: "DOCUMENTS", entityType: "Document", entityId: docId,
    newValue: { decision, comment: comment ?? null },
  });
  revalidatePath("/documents");
  return { ok: true };
}

// Starts a new revision from an approved document: the old version becomes
// OBSOLETE and a linked DRAFT is created at the next minor version.
export async function reviseDocument(docId: string): Promise<ActionResult> {
  const user = await requireUser();
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.status !== "APPROVED") return { ok: false, error: "Only an approved document can be revised." };

  const nextVersion = (Number(doc.version) + 0.1).toFixed(1);
  const seq = (await prisma.document.count()) + 1;

  const revision = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        docCode: nextDocCode(seq),
        title: doc.title,
        category: doc.category,
        version: nextVersion,
        status: "DRAFT",
        ownerId: user.id,
        previousVersionId: doc.id,
      },
    });
    await tx.document.update({ where: { id: doc.id }, data: { status: "OBSOLETE" } });
    return created;
  });

  await logAudit(user.id, {
    action: "DOCUMENT_REVISED", module: "DOCUMENTS", entityType: "Document", entityId: revision.id,
    oldValue: { docCode: doc.docCode, version: doc.version },
    newValue: { docCode: revision.docCode, version: revision.version },
  });
  revalidatePath("/documents");
  return { ok: true };
}
