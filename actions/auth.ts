"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSession, clearSession, getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { RoleCode as SessionRole } from "@/lib/roles";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export async function loginUser(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { ok: false, error: "Email and password are required." };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, client: true },
  });

  if (!user || !user.isActive) {
    return { ok: false, error: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Invalid email or password." };

  await setSession({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name as SessionRole,
    roleId: user.roleId,
    clientId: user.clientId,
  });

  await Promise.all([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    logAudit(user.id, {
      action: "USER_LOGIN",
      module: "AUTH",
      entityType: "User",
      entityId: user.id,
    }),
  ]);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await logAudit(user.id, { action: "USER_LOGOUT", module: "AUTH", entityType: "User", entityId: user.id });
  }
  await clearSession();
  redirect("/login");
}