import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/layout/shell";

// All dashboard pages read the session and hit the database — they must be
// rendered per-request, never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  const safeUser = {
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };

  return <Shell role={user.role} user={safeUser}>{children}</Shell>;
}