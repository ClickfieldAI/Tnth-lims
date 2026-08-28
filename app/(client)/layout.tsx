import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { logoutAction } from "@/actions/auth";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLIENT") redirect("/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link href="/client" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">Φ</span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-slate-900">TNTH LIMS</span>
              <span className="block text-[10.5px] text-slate-500">Client Portal</span>
            </span>
          </Link>
          <nav className="ml-6 hidden gap-1 sm:flex">
            {[
              ["/client", "Overview"],
              ["/client/samples", "My samples"],
              ["/client/reports", "Reports"],
              ["/client/invoices", "Invoices"],
              ["/client/messages", "Messages"],
            ].map(([href, label]) => (
              <Link key={href} href={href}
                className="rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <span className="hidden text-xs text-slate-500 sm:block">{user.firstName} {user.lastName}</span>
          <form action={logoutAction}>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-red-600" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
    </div>
  );
}