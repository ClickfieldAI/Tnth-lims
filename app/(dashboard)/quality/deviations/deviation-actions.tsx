"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDeviationStatus } from "@/actions/quality";
import { Button } from "@/components/ui/button";
import { SignatureButton } from "@/components/ui/signature-modal";

export function DeviationActions({ devId, status }: { devId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status === "CLOSED") return <span className="text-[11px] text-slate-400">Closed</span>;

  if (status === "OPEN") {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateDeviationStatus(devId, "INVESTIGATING");
            router.refresh();
          })
        }
      >
        Start investigation
      </Button>
    );
  }

  return (
    <SignatureButton
      label="Close (record root cause)"
      size="sm"
      variant="success"
      requireComment
      meaning="I have reviewed the investigation and root cause, and close this deviation"
      onSign={async (p) => {
        const res = await updateDeviationStatus(devId, "CLOSED", p.comment, p.password);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
