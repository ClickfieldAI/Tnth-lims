"use client";

import { useRouter } from "next/navigation";
import { Moon, Sun, LogOut } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { Avatar } from "@/components/ui/forms";
import { initials } from "@/lib/utils";

export function HubTopbar({
  user,
}: {
  user?: { firstName: string; lastName: string; role: string } | null;
}) {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  function toggleTheme() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    if (next) root.classList.add("dark");
    else root.classList.remove("dark");
    setDark(next);
  }

  async function logout() {
    await logoutAction();
    router.refresh();
  }

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 backdrop-blur px-5">
      <div className="flex-1" />
      <button
        onClick={toggleTheme}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Toggle theme"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1">
        <Avatar initials={initials(user?.firstName, user?.lastName)} name={name} />
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-slate-800">{name}</p>
          <p className="text-[10.5px] text-slate-500 capitalize">{user?.role?.toLowerCase()}</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-red-600"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
