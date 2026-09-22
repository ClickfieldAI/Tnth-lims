"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Search, ChevronDown, Moon, Sun, Menu, X } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { Avatar } from "@/components/ui/forms";
import { initials, cn } from "@/lib/utils";
import { navForRole, type NavGroup } from "@/lib/nav";
import type { RoleCode } from "@/lib/roles";

export function TopNav({
  role,
  user,
}: {
  role?: RoleCode;
  user?: { firstName: string; lastName: string; role: string } | null;
}) {
  const groups = navForRole(role);
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <header className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-white">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-1 px-4 sm:px-6">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-900/5 lg:hidden"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2 pr-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-[13px] font-bold text-white">
            Φ
          </div>
          <span className="hidden text-[14px] font-bold tracking-tight text-[#12151a] sm:block">TNTH LIMS</span>
        </Link>

        <div className="hidden h-5 w-px bg-[var(--border-soft)] lg:block" />

        <nav className="hidden h-14 items-stretch lg:flex">
          {groups.map((g) => (
            <GroupMenu key={g.group} group={g} pathname={pathname} />
          ))}
        </nav>

        <div className="flex-1" />

        <div className="hidden items-center md:flex">
          <div className="flex h-8 w-56 items-center gap-2 rounded-md border border-[var(--border-soft)] bg-slate-900/[0.025] px-2.5 text-slate-400 transition-colors focus-within:border-brand-300">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[12.5px]">Search…</span>
          </div>
        </div>

        <div className="ml-1 flex items-center gap-0.5">
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-600"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-600" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-2 flex items-center gap-2 border-l border-[var(--border-soft)] pl-3">
          <Avatar initials={initials(user?.firstName, user?.lastName)} name={name} />
          <div className="hidden text-left sm:block">
            <p className="text-[12.5px] font-semibold leading-tight text-slate-800">{name}</p>
            <p className="text-[11px] capitalize leading-tight text-slate-400">{user?.role?.toLowerCase()}</p>
          </div>
          <button
            onClick={logout}
            className="ml-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-red-600"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileOpen ? <MobileNav groups={groups} pathname={pathname} onClose={() => setMobileOpen(false)} /> : null}
    </header>
  );
}

function GroupMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActive = group.items.some((i) => i.href === pathname);
  return (
    <div className="group relative flex h-full items-center">
      <button
        className={cn(
          "relative flex h-full items-center gap-1 px-3 text-[13.5px] font-medium transition-colors duration-200",
          hasActive ? "text-brand-700" : "text-slate-600 hover:text-slate-900",
        )}
      >
        {group.group}
        <ChevronDown className="h-3 w-3 text-slate-400 transition-transform duration-200 group-hover:rotate-180" />
        <span
          className={cn(
            "absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand-600 transition-opacity duration-200",
            hasActive ? "opacity-100" : "opacity-0",
          )}
        />
      </button>
      <div className="invisible absolute left-0 top-full z-50 w-56 translate-y-1 rounded-lg border border-[var(--border-soft)] bg-white p-1 opacity-0 shadow-[var(--shadow-md)] transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MobileNav({ groups, pathname, onClose }: { groups: NavGroup[]; pathname: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">Φ</div>
            <p className="text-sm font-bold text-[#1a1d1a]">TNTH LIMS</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-900/5" aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        {groups.map((g) => (
          <div key={g.group} className="mb-3">
            <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-900/5",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
