import { TopNav } from "./topnav";
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
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav role={role} user={user} />
      <main className="mx-auto w-full max-w-[1500px] px-5 py-6">{children}</main>
    </div>
  );
}
