import bcrypt from "bcryptjs";
import { sql } from "./db";
import { blockedFor, clear, recordFailure } from "./ratelimit";

// Sign-in and password rules shared by the website and the Android app, so both are held to the same checks.

const LOGIN_PER_EMAIL = 5;
const LOGIN_PER_IP = 20;
const NO_SUCH_USER = "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";

export type LoginUser = { id: number; role: string; permissions: string[]; token_version: number; must_change: boolean };

// Checks an email and password, with rate limiting per account and per address.
export async function authenticate(email: string, password: string, ip: string): Promise<{ error: string } | { user: LoginUser }> {
  const emailKey = `login:${ip}:${email}`;
  const ipKey = `login-ip:${ip}`;
  const wait = Math.max(await blockedFor(emailKey, LOGIN_PER_EMAIL), await blockedFor(ipKey, LOGIN_PER_IP));
  if (wait) return { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` };

  const rows = await sql`SELECT id, password_hash, role, permissions, token_version, must_change FROM users WHERE email = ${email}`;
  const u = rows[0];
  // Compare even when the user is missing so response time doesn't reveal valid emails.
  const ok = await bcrypt.compare(password, u?.password_hash ?? NO_SUCH_USER);
  if (!u || !ok) {
    await Promise.all([recordFailure(emailKey), recordFailure(ipKey)]);
    return { error: "Wrong email or password" };
  }
  await clear(emailKey);
  return {
    user: {
      id: u.id as number,
      role: u.role as string,
      permissions: u.permissions as string[],
      token_version: u.token_version as number,
      must_change: u.must_change as boolean,
    },
  };
}

// Changes a password after checking the current one. Other sessions are signed out by the version bump.
export async function changePasswordFor(uid: number, current: string, next: string, confirm: string): Promise<{ error: string } | { version: number }> {
  const key = `pw:${uid}`;
  const wait = await blockedFor(key, 5);
  if (wait) return { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` };

  const rows = await sql`SELECT password_hash FROM users WHERE id = ${uid}`;
  if (!rows.length || !(await bcrypt.compare(current, rows[0].password_hash))) {
    await recordFailure(key);
    return { error: "Current password is wrong" };
  }
  if (next.length < 8) return { error: "New password must be at least 8 characters" };
  if (next !== confirm) return { error: "The new passwords don't match" };
  if (next === current) return { error: "Choose a password you haven't used just now" };

  const updated = await sql`
    UPDATE users SET password_hash = ${await bcrypt.hash(next, 10)}, must_change = false, token_version = token_version + 1
    WHERE id = ${uid} RETURNING token_version`;
  await clear(key);
  return { version: updated[0].token_version as number };
}
