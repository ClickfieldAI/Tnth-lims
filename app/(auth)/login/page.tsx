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
    <main className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-4">
        <div className="mx-auto rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-base font-bold text-white">
                Φ
              </div>
              <div>
                <p className="text-base font-bold tracking-tight text-white">PharmaLIMS</p>
                <p className="text-[11px] text-slate-400">Laboratory Information Management System</p>
              </div>
            </div>
            <h1 className="mt-2 text-lg font-semibold text-slate-100">Sign in to your workspace</h1>
            <p className="text-xs text-slate-400">GMP-compliant pharmaceutical testing laboratory</p>
          </div>
          <LoginForm />
          <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
            Demo credentials — select a role below to explore. This system records a full audit trail of all
            authentication and data operations per GMP data-integrity requirements.
          </p>
        </div>
      </div>
    </main>
  );
}