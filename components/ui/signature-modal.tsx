"use client";

import React, { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/forms";
import { cn } from "@/lib/utils";

export interface SignaturePayload {
  password: string;
  comment: string;
}

export function SignatureButton({
  label,
  meaning,
  variant = "primary",
  size = "default",
  className,
  requireComment = false,
  onSign,
}: {
  label: string;
  meaning: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  requireComment?: boolean;
  onSign: (payload: SignaturePayload) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    setOpen(false);
    setPassword("");
    setComment("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (requireComment && !comment.trim()) {
      setError("A reason is required for this signature.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await onSign({ password, comment });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Signature failed.");
      return;
    }
    close();
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0c0b1a]/60 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-sm rounded-lg border border-[var(--border-soft)] bg-white p-5 shadow-[var(--shadow-lg)]">
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-900/5"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500/10 text-brand-600">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1a1d1a]">Electronic signature required</p>
                <p className="text-xs text-slate-500">Re-enter your password to attest: “{meaning}”</p>
              </div>
            </div>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <Field label="Password" required>
                <Input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label={requireComment ? "Reason" : "Comment (optional)"} required={requireComment}>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              </Field>
              {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || !password}>
                  {pending ? "Signing…" : "Sign & confirm"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
