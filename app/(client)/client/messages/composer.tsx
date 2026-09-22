"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendClientMessage } from "@/actions/client-portal";

export function MessageComposer() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function send() {
    if (!value.trim()) return;
    const fd = new FormData();
    fd.set("body", value);
    setError(null);
    startTransition(async () => {
      const res = await sendClientMessage(fd);
      if (!res.ok) return setError(res.error ?? "Failed to send");
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="border-t border-slate-200 pt-3">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message to the laboratory…"
          className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        />
        <button
          onClick={send}
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Send
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}