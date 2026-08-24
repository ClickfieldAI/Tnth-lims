"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/actions/samples";
import { nextReportCode } from "@/lib/ids";

// Analyst submits raw results / observations for a test.
export async function submitTestResult(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  const test = await prisma.test.findUnique({ where: { id: testId }, include: { sample: true } });
  if (!test) return { ok: false, error: "Test not found." };

  const observations = String(formData.get("observations") ?? "");
  const instrumentId = String(formData.get("instrumentId") ?? "") || null;
  const rawValues = formData.getAll("timepoint").map(String).filter(Boolean);

  // Assay-specific
  const assayPercent = formData.get("assayPercent");

  await prisma.test.update({
    where: { id: testId },
    data: {
      status: "REVIEW",
      completedAt: new Date(),
      worksheetData: {
        observations,
        timepoints: rawValues,
        enteredBy: `${user.firstName} ${user.lastName}`,
        enteredAt: new Date().toISOString(),
      },
    },
  });

  if (test.type === "ASSAY") {
    const value = Number(assayPercent);
    const low = Number(formData.get("expectedLow")) || 95;
    const high = Number(formData.get("expectedHigh")) || 105;
    const pass = value >= low && value <= high;
    await prisma.assayResult.upsert({
      where: { testId },
      update: { resultPercent: value, expectedLow: low, expectedHigh: high, specPass: pass, observations, status: "COMPLETED", instrumentId },
      create: {
        testId, apiLabel: "Label claim 100%", expectedLow: low, expectedHigh: high,
        resultPercent: value, specPass: pass, observations,
        calculationMethod: "Area normalization", status: "COMPLETED", instrumentId,
      },
    });
    await prisma.test.update({
      where: { id: testId },
      data: {
        result: `${value.toFixed(1)}%`,
        resultStatus: pass ? "PASS" : "FAIL",
      },
    });
    // Out-of-specification → auto-open a deviation for QA investigation.
    if (!pass) {
      const seq = (await prisma.deviation.count()) + 1;
      await prisma.deviation.create({
        data: {
          deviationId: `DEV-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`,
          sampleId: test.sampleId, testId,
          description: `Assay result ${value.toFixed(1)}% outside specification ${low}–${high}%.`,
          category: "ANALYTICAL", impactLevel: "MAJOR",
          status: "OPEN", reportedById: user.id,
        },
      });
    }
  }

  await logAudit(user.id, {
    action: "RESULT_ENTERED", module: "TESTING", entityType: "Test", entityId: testId,
    newValue: { observations, assayPercent: assayPercent ? String(assayPercent) : undefined },
  });

  revalidatePath(`/testing/worksheet/${testId}`);
  return { ok: true };
}

// Lab manager / QA review & approve.
export async function reviewTest(testId: string, action: "APPROVE" | "REJECT", comment?: string): Promise<ActionResult> {
  const user = await requireUser();
  const test = await prisma.test.findUnique({ where: { id: testId }, include: { sample: true } });
  if (!test) return { ok: false, error: "Test not found." };

  if (action === "APPROVE") {
    await prisma.test.update({
      where: { id: testId },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    // Generate an approved report automatically.
    const seq = (await prisma.testReport.count()) + 1;
    const existing = await prisma.testReport.findFirst({ where: { testId } });
    if (!existing) {
      await prisma.testReport.create({
        data: {
          reportCode: nextReportCode(seq),
          sampleId: test.sampleId, testId,
          type: test.type === "MICROBIOLOGY" ? "MICROBIOLOGY" : test.type,
          title: `${test.testName} Report`,
          status: "APPROVED",
          generatedById: user.id, approvedById: user.id, approvedAt: new Date(),
          content: { summary: test.result, status: test.resultStatus },
        },
      });
    }
    // Move sample forward when all its tests are approved.
    const remaining = await prisma.test.count({ where: { sampleId: test.sampleId, status: { notIn: ["APPROVED", "REJECTED"] } } });
    if (remaining === 0) {
      await prisma.sample.update({ where: { id: test.sampleId }, data: { status: "REVIEW" } });
    }
  } else {
    await prisma.test.update({
      where: { id: testId },
      data: { status: "TESTING", approvedById: null, approvedAt: null },
    });
  }

  await prisma.approval.create({
    data: {
      referenceType: "TEST", referenceId: testId,
      approverId: user.id, action,
      comment: comment || null,
    },
  });

  await logAudit(user.id, {
    action: action === "APPROVE" ? "TEST_APPROVED" : "TEST_RETURNED",
    module: "QUALITY", entityType: "Test", entityId: testId,
    newValue: { comment: comment ?? null },
  });

  revalidatePath(`/testing/worksheet/${testId}`);
  return { ok: true };
}