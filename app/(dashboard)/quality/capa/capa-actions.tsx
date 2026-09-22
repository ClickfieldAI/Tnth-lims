"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCapaStatus } from "@/actions/quality";
import { Button } from "@/components/ui/button";
import { SignatureButton } from "@/components/ui/signature-modal";

export function CapaActions({ capaId, status }: { capaId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status === "CLOSED" || status === "VERIFIED") return null;

  if (status === "OPEN" || status === "IN_PROGRESS") {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateCapaStatus(capaId, status === "OPEN" ? "IN_PROGRESS" : "COMPLETE");
            router.refresh();
          })
        }
      >
        {status === "OPEN" ? "Start action" : "Mark action complete"}
      </Button>
    );
  }

  // COMPLETE — awaiting effectiveness check before closure.
  return (
    <SignatureButton
      label="Verify effectiveness & close"
      size="sm"
      variant="success"
      requireComment
      meaning="I have verified the effectiveness of this CAPA and close it"
      onSign={async (p) => {
        const res = await updateCapaStatus(capaId, "VERIFIED", p.password, p.comment);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
