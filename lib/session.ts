import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { sql } from "./db";
import { effectivePermissions, homeFor, type Permission } from "./permissions";

// v is users.token_version: bumping it (password change/reset) signs the user out everywhere.
export type Session = { uid: number; email: string; role: string; v: number };

const COOKIE = "session";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return {
      uid: payload.uid as number,
      email: payload.email as string,
      role: payload.role as string,
      v: (payload.v as number | undefined) ?? -1,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

// Signed-in user, checked against the database so deleted users, permission changes and
// password resets take effect on the next request. Does not enforce a pending password change.
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  const rows = await sql`SELECT email, role, permissions, token_version, must_change FROM users WHERE id = ${s.uid}`;
  const u = rows[0];
  if (!u || u.token_version !== s.v) redirect("/login");
  const role = u.role as string;
  return {
    uid: s.uid,
    email: u.email as string,
    role,
    isAdmin: role === "admin",
    perms: effectivePermissions(role, u.permissions as string[]),
    v: s.v,
    mustChange: u.must_change as boolean,
  };
}

export type User = Awaited<ReturnType<typeof requireUser>>;

// The user must hold at least one of the permissions (administrators hold all of them).
export async function requirePermission(...needed: Permission[]) {
  const s = await requireUser();
  if (s.mustChange) redirect("/account");
  if (!needed.some((p) => s.perms.includes(p))) redirect(homeFor(s.perms));
  return s;
}

export async function requireAdmin() {
  const s = await requireUser();
  if (s.mustChange) redirect("/account");
  if (!s.isAdmin) redirect(homeFor(s.perms));
  return s;
}
