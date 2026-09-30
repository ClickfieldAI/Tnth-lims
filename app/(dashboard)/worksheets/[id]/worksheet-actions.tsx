"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prepareWorksheetAction, assignWorksheetAction, removeTestFromWorksheetAction } from "@/actions/worksheets";

export function PrepareButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { await prepareWorksheetAction(id); router.refresh(); })}>
      {pending ? "Preparing…" : "Mark as Prepared"}
    </Button>
  );
}

export function AssignButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { await assignWorksheetAction(id); router.refresh(); })}>
      {pending ? "Assigning…" : "Assign to Analyst"}
    </Button>
  );
}

export function RemoveTestButton({ worksheetId, testAllocationId }: { worksheetId: string; testAllocationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { await removeTestFromWorksheetAction(worksheetId, testAllocationId); router.refresh(); })}>
      Remove
    </Button>
  );
}
