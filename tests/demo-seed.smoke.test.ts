import { describe, it, expect } from "vitest";
import { seedDemoWorkflow } from "@/lib/mock/demo-workflow-seed";
import { prisma } from "@/lib/prisma";

describe("demo workflow seed", () => {
  it("runs the full pipeline end-to-end without throwing, producing interconnected demo data", async () => {
    await seedDemoWorkflow();

    const releases = await prisma.reportRelease.findMany({ where: { status: "RELEASED" } });
    expect(releases.length).toBeGreaterThan(0);

    const deliveries = await prisma.reportDelivery.findMany({});
    expect(deliveries.length).toBeGreaterThan(0);

    const retained = await prisma.retentionRecord.findMany({});
    expect(retained.length).toBeGreaterThan(0);

    const completedCorrections = await prisma.correction.findMany({ where: { status: "COMPLETED" } });
    expect(completedCorrections.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((completedCorrections[0] as any).newRevisionId).toBeTruthy();

    const pendingQa = await prisma.qaReview.findMany({ where: { status: "PENDING" } });
    expect(pendingQa.length).toBeGreaterThan(0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allocations = await (prisma.testAllocation.findMany({}) as any);
    expect(allocations.length).toBeGreaterThan(0);
  });
});
