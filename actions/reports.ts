"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { signApproval, SignatureError } from "@/lib/esign";
import type { ActionResult } from "@/actions/samples";

// QA sign-off that a compiled report is fit to stand as the controlled record.
export async function approveReport(reportId: string, password: string, comment?: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "QA", "MANAGER");
  const report = await prisma.testReport.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };

  try {
    const approval = await signApproval(user, password, {
      referenceType: "REPORT",
      referenceId: reportId,
      action: "APPROVE",
      meaning: `I approve report ${report.reportCode} as accurate and complete`,
      comment,
      recordSnapshot: { reportCode: report.reportCode, title: report.title, content: report.content },
    });

    await prisma.testReport.update({
      where: { id: reportId },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), digitalSignature: approval.id },
    });
  } catch (e) {
    if (e instanceof SignatureError) return { ok: false, error: e.message };
    throw e;
  }

  await logAudit(user.id, {
    action: "REPORT_APPROVED", module: "REPORTS", entityType: "TestReport", entityId: reportId,
    newValue: { comment: comment ?? null },
  });
  revalidatePath("/reports");
  return { ok: true };
}

// Final release — the point at which a report/CoA becomes visible to the client.
export async function releaseReport(reportId: string, password: string, comment?: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "QA");
  const report = await prisma.testReport.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };
  if (report.status !== "APPROVED") return { ok: false, error: "Report must be approved before release." };

  try {
    await signApproval(user, password, {
      referenceType: "REPORT",
      referenceId: reportId,
      action: "RELEASE",
      meaning: `I authorize release of report ${report.reportCode} to the client`,
      comment,
      recordSnapshot: { reportCode: report.reportCode, title: report.title },
    });

    await prisma.testReport.update({ where: { id: reportId }, data: { status: "RELEASED" } });
  } catch (e) {
    if (e instanceof SignatureError) return { ok: false, error: e.message };
    throw e;
  }

  await logAudit(user.id, {
    action: "REPORT_RELEASED", module: "REPORTS", entityType: "TestReport", entityId: reportId,
    newValue: { comment: comment ?? null },
  });
  revalidatePath("/reports");
  return { ok: true };
}
