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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
          Φ
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-slate-900">PharmaLIMS</p>
          <p className="text-[10.5px] text-slate-500">GMP Testing Laboratory</p>
        </div>
      </div>
      <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>
            {g.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                    active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 text-[10.5px] text-slate-400">v1.0 · ISO 17025 / GMP</div>
    </div>
  );
}

export function Sidebar({ role }: { role?: RoleCode }) {
  const groups = navForRole(role);
  return (
    <aside className="sticky top-0 hidden h-screen w-60 border-r border-slate-200 bg-white lg:block">
      <SidebarContent groups={groups} />
    </aside>
  );
}

export function MobileSidebar({ role, onClose }: { role?: RoleCode; onClose: () => void }) {
  const groups = navForRole(role);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-64 border-r bg-white p-0">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent groups={groups} />
      </div>
    </div>
  );
}