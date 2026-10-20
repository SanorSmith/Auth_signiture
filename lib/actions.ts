"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { blockedFor, clear, recordFailure } from "./ratelimit";
import { CODE_RE, generateCode10, hashCode, vcodeFromCounter } from "./codes";
import { createSession, destroySession, homeFor, requireRole, type Role } from "./session";

export type State = { error?: string; code?: string; vcode?: string; ok?: string } | null;

const LOGIN_PER_EMAIL = 5;
const LOGIN_PER_IP = 20;

export async function login(_: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const emailKey = `login:${ip}:${email}`;
  const ipKey = `login-ip:${ip}`;
  const wait = Math.max(await blockedFor(emailKey, LOGIN_PER_EMAIL), await blockedFor(ipKey, LOGIN_PER_IP));
  if (wait) return { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` };

  const rows = await sql`SELECT id, password_hash, role FROM users WHERE email = ${email}`;
  const u = rows[0];
  // Compare even when the user is missing so response time doesn't reveal valid emails.
  const hash = u?.password_hash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
  const ok = await bcrypt.compare(password, hash);
  if (!u || !ok) {
    await Promise.all([recordFailure(emailKey), recordFailure(ipKey)]);
    return { error: "Wrong email or password" };
  }
  await clear(emailKey);
  await createSession({ uid: u.id, email, role: u.role as Role });
  redirect(homeFor(u.role as Role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// Client: mint a code. Only its keyed hash is stored; the number is shown once.
export async function createClientCode(): Promise<State> {
  const s = await requireRole("client");
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode10();
    const rows = await sql`
      INSERT INTO codes (code_hash, client_id) VALUES (${hashCode(code)}, ${s.uid})
      ON CONFLICT (code_hash) DO NOTHING RETURNING id`;
    if (rows.length) return { code };
  }
  return { error: "Could not generate a code, try again" };
}

// Admin: attach the next verification code to a client's number (idempotent).
export async function issueVerification(_: State, form: FormData): Promise<State> {
  const s = await requireRole("admin");
  const code = String(form.get("code") ?? "").trim();
  if (!CODE_RE.test(code)) return { error: "Enter the 10-digit number" };
  const h = hashCode(code);

  const known = await sql`SELECT 1 FROM codes WHERE code_hash = ${h}`;
  if (!known.length) return { error: "No client has been given this number" };

  const existing = await sql`SELECT vcode FROM verifications WHERE code_hash = ${h}`;
  if (existing.length) return { vcode: existing[0].vcode.trim() };

  const [{ n }] = await sql`SELECT nextval('vcode_counter')::float8 AS n`;
  const vcode = vcodeFromCounter(Number(n));
  const ins = await sql`
    INSERT INTO verifications (code_hash, vcode, issued_by) VALUES (${h}, ${vcode}, ${s.uid})
    ON CONFLICT (code_hash) DO NOTHING RETURNING vcode`;
  if (ins.length) return { vcode };
  const again = await sql`SELECT vcode FROM verifications WHERE code_hash = ${h}`;
  return { vcode: again[0].vcode.trim() };
}

// Monitor (and admin): scan the 10-digit number, get the verification code.
export async function lookupVerification(_: State, form: FormData): Promise<State> {
  await requireRole("monitor", "admin");
  const code = String(form.get("code") ?? "").trim();
  if (!CODE_RE.test(code)) return { error: "Not a valid 10-digit number" };
  const rows = await sql`SELECT vcode FROM verifications WHERE code_hash = ${hashCode(code)}`;
  if (!rows.length) return { error: "No verification code issued for this number" };
  return { vcode: rows[0].vcode.trim() };
}

export async function createUser(_: State, form: FormData): Promise<State> {
  await requireRole("admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Invalid email" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (!["admin", "client", "monitor"].includes(role)) return { error: "Invalid role" };
  const rows = await sql`
    INSERT INTO users (email, password_hash, role) VALUES (${email}, ${await bcrypt.hash(password, 10)}, ${role})
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  return rows.length ? { ok: `Created ${role} ${email}` } : { error: "Email already exists" };
}
