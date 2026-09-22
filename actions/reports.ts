"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { signApproval, SignatureError } from "@/lib/esign";
import type { ActionResult } from "@/actions/samples";
import { getTnthReportData, type TnthReportData } from "@/lib/tnth-report";

// Used by the client-side PDF export button — the official TNTH report
// template is per-SAMPLE (it aggregates every test run against that sample
// into report sections), not per single Test row.
export async function getReportPdfData(sampleId: string): Promise<TnthReportData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "CLIENT") {
    const sample = await prisma.sample.findUnique({ where: { id: sampleId }, select: { clientId: true } });
    if (!sample || sample.clientId !== user.clientId) return null;
  }
  return getTnthReportData(sampleId);
}

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
