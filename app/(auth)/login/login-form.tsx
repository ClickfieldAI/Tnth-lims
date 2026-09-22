"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/actions/auth";

type Demo = { role: string; email: string; pass: string; desc: string };

const DEMO: Demo[] = [
  { role: "Admin", email: "admin@tnth.io", pass: "Admin@123", desc: "Laboratory Administrator" },
  { role: "Manager", email: "manager@tnth.io", pass: "Manager@123", desc: "Lab Manager" },
  { role: "QA", email: "qa@tnth.io", pass: "Qa@123456", desc: "Quality Assurance Officer" },
  { role: "Analyst", email: "analyst@tnth.io", pass: "Analyst@123", desc: "Chemist / Analyst" },
  { role: "Micro", email: "micro@tnth.io", pass: "Micro@123", desc: "Microbiology Analyst" },
  { role: "Client", email: "client@tnth.io", pass: "Client@123", desc: "Client Company" },
];

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function quickFill(email: string, pass: string) {
    const emailEl = document.getElementById("login_email") as HTMLInputElement | null;
    const passEl = document.getElementById("login_password") as HTMLInputElement | null;
    if (emailEl) emailEl.value = email;
    if (passEl) passEl.value = pass;
  }

  async function onAction(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await loginUser(formData);
    if (!res.ok) {
      setError(res.error ?? "Login failed");
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <form action={onAction} className="grid gap-3">
      <div className="grid gap-2">
        <label htmlFor="login_email" className="text-xs font-medium text-slate-600">
          Work email
        </label>
        <input
          id="login_email"
          name="email"
          type="email"
          autoComplete="username"
          className="h-10 w-full rounded-lg border border-[var(--border-soft)] bg-white px-3 text-sm text-[#14162b] placeholder:text-slate-400 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-300"
          placeholder="you@tnth.io"
          required
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="login_password" className="text-xs font-medium text-slate-600">
          Password
        </label>
        <input
          id="login_password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-10 w-full rounded-lg border border-[var(--border-soft)] bg-white px-3 text-sm text-[#14162b] placeholder:text-slate-400 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-300"
          placeholder="••••••••"
          required
        />
      </div>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      <button
        disabled={pending}
        className="h-10 w-full rounded-md bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="mt-2 border-t border-[var(--border-soft)] pt-3">
        <p className="text-[11px] font-semibold text-slate-500">Demo quick access — click a role to fill credentials</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => quickFill(d.email, d.pass)}
              className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/10 hover:bg-brand-100"
              title={`${d.desc} — ${d.email}`}
            >
              {d.role}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
