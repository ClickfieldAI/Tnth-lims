import { Settings, Users, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Administration" };

const ROLE_TONE: Record<string, string> = {
  ADMIN: "red", MANAGER: "blue", QA: "violet",
  ANALYST: "indigo", MICRO: "green", CLIENT: "amber",
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
        Administrator access is required to view this area.
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { role: true, client: true },
  });
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Administration"
        description="Users, role-based access control and workflow configuration for the laboratory."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={users.length} icon={<Users className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Active" value={users.filter((u) => u.isActive).length} tone="green" />
        <StatCard label="Roles configured" value={roles.length} icon={<ShieldCheck className="h-4 w-4" />} tone="violet" />
        <StatCard label="Permissions granted" value={roles.reduce((a, r) => a + r.permissions.length, 0)} tone="slate" />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Users</h2>
        <DataTable>
          <THead>
            <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Client scope</Th><Th>Last login</Th><Th>Status</Th>
          </THead>
          <TBody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td className="font-medium">{u.firstName} {u.lastName}</Td>
                <Td className="text-xs text-slate-500">{u.email}</Td>
                <Td><Badge tone={ROLE_TONE[u.role.name] ?? "slate"}>{u.role.name}</Badge></Td>
                <Td className="text-xs">{u.client?.name ?? "Internal"}</Td>
                <Td className="text-xs">{formatDateTime(u.lastLoginAt)}</Td>
                <Td><StatusBadge status={u.isActive ? "ACTIVE" : "CLOSED"} dot /></Td>
              </Tr>
            ))}
            {!users.length ? <TableEmpty colSpan={6} /> : null}
          </TBody>
        </DataTable>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Roles & permissions</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{r.name} — {r.description}</p>
                <Badge tone={ROLE_TONE[r.name] ?? "slate"}>{r._count.users} users</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.permissions.slice(0, 12).map((rp) => (
                  <span key={rp.permissionId ?? rp.permission.code} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    {rp.permission.code}
                  </span>
                ))}
                {r.permissions.length > 12 ? (
                  <span className="text-[10px] text-slate-400">+{r.permissions.length - 12} more</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}