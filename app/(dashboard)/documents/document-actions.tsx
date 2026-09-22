"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDocumentForReview, decideDocument, reviseDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { SignatureButton } from "@/components/ui/signature-modal";

export function DocumentActions({ docId, status, canApprove }: { docId: string; status: string; canApprove: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status === "DRAFT") {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await submitDocumentForReview(docId);
            router.refresh();
          })
        }
      >
        Submit for review
      </Button>
    );
  }

  if (status === "UNDER_REVIEW") {
    if (!canApprove) return <span className="text-[11px] text-slate-400">Awaiting QA</span>;
    return (
      <div className="flex gap-1.5">
        <SignatureButton
          label="Approve"
          size="sm"
          variant="success"
          meaning="I approve this document as effective"
          onSign={async (p) => {
            const res = await decideDocument(docId, "APPROVED", p.password, p.comment);
            if (res.ok) router.refresh();
            return res;
          }}
        />
        <SignatureButton
          label="Return"
          size="sm"
          variant="danger"
          requireComment
          meaning="I am returning this document to draft"
          onSign={async (p) => {
            const res = await decideDocument(docId, "DRAFT", p.password, p.comment);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await reviseDocument(docId);
            router.refresh();
          })
        }
      >
        Start new revision
      </Button>
    );
  }

  return <span className="text-[11px] text-slate-400">Obsolete</span>;
}
