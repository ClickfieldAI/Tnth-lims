import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
  userAgent?: string;
}

// Record an audit trail entry for every important state change.
// For an enterprise LIMS, every mutation must be traceable.
export async function logAudit(
  userId: string | null,
  entry: AuditEntry,
  ctx?: { ip?: string; userAgent?: string },
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: entry.action,
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue === undefined ? null : JSON.parse(JSON.stringify(entry.oldValue ?? null)),
        newValue: entry.newValue === undefined ? null : JSON.parse(JSON.stringify(entry.newValue ?? null)),
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });
  } catch (e) {
    // Auditing must never break the core operation; log loudly in dev.
    console.error("[audit] failed to persist", e);
  }
}