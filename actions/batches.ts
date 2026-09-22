"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { signApproval, SignatureError } from "@/lib/esign";
import type { ActionResult } from "@/actions/samples";

// Final disposition of a batch — the compliance gate before product can ship.
// Restricted to QA/Admin and requires an e-signature.
export async function releaseBatch(
  batchId: string,
  decision: "RELEASED" | "REJECTED",
  password: string,
  comment?: string,
): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "QA");

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { samples: { include: { tests: true } } },
  });
  if (!batch) return { ok: false, error: "Batch not found." };

  const allTests = batch.samples.flatMap((s) => s.tests);
  const complete = allTests.length > 0 && allTests.every((t) => t.status === "APPROVED");
  if (decision === "RELEASED" && !complete) {
    return { ok: false, error: "All tests must be approved before release." };
  }

  try {
    await signApproval(user, password, {
      referenceType: "BATCH",
      referenceId: batchId,
      action: decision,
      meaning:
        decision === "RELEASED"
          ? "I certify this batch meets specification and authorize release"
          : "I am rejecting this batch disposition",
      comment,
      recordSnapshot: {
        batchNumber: batch.batchNumber,
        testCount: allTests.length,
        allApproved: complete,
      },
    });
  } catch (e) {
    if (e instanceof SignatureError) return { ok: false, error: e.message };
    throw e;
  }

  await prisma.batch.update({
    where: { id: batchId },
    data: {
      releaseStatus: decision,
      releasedAt: decision === "RELEASED" ? new Date() : null,
    },
  });

  await logAudit(user.id, {
    action: decision === "RELEASED" ? "BATCH_RELEASED" : "BATCH_REJECTED",
    module: "BATCH_RELEASE",
    entityType: "Batch",
    entityId: batchId,
    newValue: { batchNumber: batch.batchNumber, decision, comment: comment ?? null },
  });

  revalidatePath("/batch-release");
  return { ok: true };
}
