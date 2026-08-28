"use client";

import { useState } from "react";
import { Sidebar, MobileSidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { RoleCode } from "@/lib/roles";

export function Shell({
  role,
  user,
  children,
}: {
  role?: RoleCode;
  user?: { firstName: string; lastName: string; role: string } | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      {open ? <MobileSidebar role={role} onClose={() => setOpen(false)} /> : null}
      <div className="flex flex-1 flex-col bg-slate-50/70">
        <Topbar user={user} onMenu={() => setOpen(true)} />
        <main key="main" className="flex-1 px-5 py-6 max-w-[1500px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}