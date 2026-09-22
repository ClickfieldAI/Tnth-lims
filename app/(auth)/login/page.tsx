import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

// The login page checks the session cookie — must render per request.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "CLIENT") redirect("/client");
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f9fc] px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-700)] opacity-20 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white/90 p-8 shadow-[var(--shadow-lg)] backdrop-blur">
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient text-base font-bold text-white shadow-[var(--shadow-glow)]">
                Φ
              </div>
              <div>
                <p className="text-base font-bold tracking-tight text-[#14162b]">TNTH LIMS</p>
                <p className="text-[11px] text-slate-500">Laboratory Information Management System</p>
              </div>
            </div>
            <h1 className="mt-3 text-lg font-semibold text-[#14162b]">Sign in to your workspace</h1>
            <p className="text-xs text-slate-500">NABL-accredited multi-discipline contract testing laboratory</p>
          </div>
          <LoginForm />
          <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
            Demo credentials — select a role below to explore. This system records a full audit trail of all
            authentication and data operations per GMP data-integrity requirements.
          </p>
        </div>
      </div>
    </main>
  );
}
