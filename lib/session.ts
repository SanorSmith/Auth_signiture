import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

export type Role = "admin" | "client" | "monitor";
export type Session = { uid: number; email: string; role: Role };

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
    return { uid: payload.uid as number, email: payload.email as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const homeFor = (role: Role) => `/${role}`;

export async function requireRole(...roles: Role[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!roles.includes(s.role)) redirect(homeFor(s.role));
  return s;
}
