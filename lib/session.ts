import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "@/lib/roles";

export const SESSION_COOKIE = "pharma_lims_session";
const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleCode;
  roleId: string;
  clientId?: string | null;
}

export interface SessionToken {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function signSession(user: SessionUser): string {
  const token: SessionToken = { sub: user.id, email: user.email };
  return jwt.sign(token, SECRET, { expiresIn: `${TTL_DAYS}d` });
}

export function verifySession(token?: string | null): SessionToken | null {
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET) as SessionToken;
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const token = signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL_DAYS * 86400,
    path: "/",
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface CurrentUser extends SessionUser {
  permissions: string[];
}

// Loads the session user (role + permissions) — cached per request.
export const getCurrentUser = cache(async function (): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      client: true,
    },
  });
  if (!user || !user.isActive) return null;

  const role = user.role.name as RoleCode;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role,
    roleId: user.roleId,
    clientId: user.clientId,
    permissions: user.role.permissions.map((p) => p.permission.code),
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTHENTICATION_REQUIRED");
  return user;
}

export async function requireRole(...roles: RoleCode[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}