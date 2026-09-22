"use client";

import { useRouter } from "next/navigation";
import { approveReport, releaseReport } from "@/actions/reports";
import { SignatureButton } from "@/components/ui/signature-modal";

export function ReportActions({ reportId, status, canDecide }: { reportId: string; status: string; canDecide: boolean }) {
  const router = useRouter();

  if (!canDecide) return null;

  if (status === "DRAFT" || status === "UNDER_REVIEW") {
    return (
      <SignatureButton
        label="Approve"
        size="sm"
        variant="success"
        meaning="I approve this report as accurate and complete"
        onSign={async (p) => {
          const res = await approveReport(reportId, p.password, p.comment);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    );
  }

  if (status === "APPROVED") {
    return (
      <SignatureButton
        label="Release to client"
        size="sm"
        variant="primary"
        meaning="I authorize release of this report to the client"
        onSign={async (p) => {
          const res = await releaseReport(reportId, p.password, p.comment);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    );
  }

  return null;
}
