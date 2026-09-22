"use client";

import { useRouter } from "next/navigation";
import { releaseBatch } from "@/actions/batches";
import { SignatureButton } from "@/components/ui/signature-modal";
import { Button } from "@/components/ui/button";

export function DispositionActions({ batchId, complete }: { batchId: string; complete: boolean }) {
  const router = useRouter();

  async function sign(decision: "RELEASED" | "REJECTED", payload: { password: string; comment: string }) {
    const res = await releaseBatch(batchId, decision, payload.password, payload.comment);
    if (res.ok) router.refresh();
    return res;
  }

  return (
    <div className="flex gap-1.5">
      {complete ? (
        <SignatureButton
          label="Release"
          size="sm"
          variant="success"
          meaning="I certify this batch meets specification and authorize release"
          onSign={(p) => sign("RELEASED", p)}
        />
      ) : (
        <Button size="sm" variant="success" disabled title="All tests must be approved first">
          Release
        </Button>
      )}
      <SignatureButton
        label="Reject"
        size="sm"
        variant="danger"
        requireComment
        meaning="I am rejecting this batch disposition"
        onSign={(p) => sign("REJECTED", p)}
      />
    </div>
  );
}
