"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmTrfReceiptAction } from "@/actions/receipts";

export function ConfirmReceiptButton({ trfId }: { trfId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        onClick={() => startTransition(async () => {
          setError(null);
          const res = await confirmTrfReceiptAction(trfId);
          if (!res.ok) return setError(res.error ?? "Failed to confirm receipt.");
          router.refresh();
        })}
        disabled={pending}
      >
        {pending ? "Confirming…" : "Confirm Receipt"}
      </Button>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
