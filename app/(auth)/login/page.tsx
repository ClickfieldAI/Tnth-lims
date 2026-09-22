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
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="relative w-full max-w-md">
        <div className="rounded-lg border border-[var(--border-soft)] bg-white p-8 shadow-[var(--shadow-md)]">
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-700 text-base font-bold text-white">
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
