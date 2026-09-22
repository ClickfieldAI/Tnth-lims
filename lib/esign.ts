import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/session";

export class SignatureError extends Error {}

// Re-verifies the acting user's password at the moment of signing (not just
// an active session) and records a Part 11-style e-signature: who, what it
// means, and a snapshot of the record state being attested to.
export async function signApproval(
  user: CurrentUser,
  password: string,
  params: {
    referenceType: string;
    referenceId: string;
    action: string;
    meaning: string;
    comment?: string | null;
    recordSnapshot?: unknown;
  },
) {
  if (!password) throw new SignatureError("Password is required to sign.");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new SignatureError("User not found.");

  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    await logAudit(user.id, {
      action: "SIGNATURE_REJECTED", module: "ESIGN",
      entityType: params.referenceType, entityId: params.referenceId,
      newValue: { reason: "invalid_password" },
    });
    throw new SignatureError("Incorrect password. Signature not applied.");
  }

  const approval = await prisma.approval.create({
    data: {
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      approverId: user.id,
      action: params.action,
      meaning: params.meaning,
      comment: params.comment || null,
      recordSnapshot: params.recordSnapshot == null ? undefined : JSON.parse(JSON.stringify(params.recordSnapshot)),
    },
  });

  await logAudit(user.id, {
    action: "SIGNATURE_APPLIED", module: "ESIGN",
    entityType: params.referenceType, entityId: params.referenceId,
    newValue: { meaning: params.meaning, action: params.action },
  });

  return approval;
}
