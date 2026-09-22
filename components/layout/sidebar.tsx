"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { navForRole, type NavGroup } from "@/lib/nav";
import type { RoleCode } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function SidebarContent({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-[#0f1c26]">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-brand-700 text-sm font-bold text-white">
          Φ
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-white">TNTH LIMS</p>
          <p className="text-[10.5px] text-slate-400">Multi-Discipline Testing Lab</p>
        </div>
      </div>
      <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.group} className="mb-1">
            <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</p>
            {g.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-brand-700 text-white"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
                  )}
                >
                  <Icon className={cn("h-4 w-4 transition-colors", active ? "text-white" : "text-slate-500 group-hover:text-slate-200")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.06] px-4 py-3 text-[10.5px] text-slate-500">v1.0 · ISO 17025 / GMP</div>
    </div>
  );
}

export function Sidebar({ role }: { role?: RoleCode }) {
  const groups = navForRole(role);
  return (
    <aside className="sticky top-0 hidden h-screen w-60 lg:block">
      <SidebarContent groups={groups} />
    </aside>
  );
}

export function MobileSidebar({ role, onClose }: { role?: RoleCode; onClose: () => void }) {
  const groups = navForRole(role);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-[#0d151c]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-64 p-0 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-white/10"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent groups={groups} />
      </div>
    </div>
  );
}