"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { blockedFor, clear, recordFailure } from "./ratelimit";
import { CODE_RE, encryptPending, hashCode, vcodeFromCounter } from "./codes";
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

// Client: scan a 10-digit number to request its verification code. The number is kept
// encrypted only until the admin issues the code; afterwards just its keyed hash remains.
export async function requestVerification(_: State, form: FormData): Promise<State> {
  const s = await requireRole("client");
  const code = String(form.get("code") ?? "").trim();
  if (!CODE_RE.test(code)) return { error: "Not a valid 10-digit number" };
  const h = hashCode(code);

  const found = await sql`
    SELECT c.client_id, v.vcode FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash WHERE c.code_hash = ${h}`;
  if (found.length) {
    if (found[0].client_id !== s.uid) return { error: "This number has already been requested" };
    // Re-scanning your own number makes it the one the client page shows.
    await sql`UPDATE codes SET last_scanned_at = now() WHERE code_hash = ${h}`;
    revalidatePath("/client");
    return { ok: found[0].vcode ? "Verification code shown below" : "Already requested, waiting for the admin" };
  }
  const ins = await sql`
    INSERT INTO codes (code_hash, client_id, pending_enc) VALUES (${h}, ${s.uid}, ${encryptPending(code)})
    ON CONFLICT (code_hash) DO NOTHING RETURNING id`;
  revalidatePath("/client");
  return ins.length ? { ok: "Request sent, waiting for the admin" } : { error: "This number has already been requested" };
}

// Admin: generate the next letter + 5 digit code for a pending request, then wipe the stored number.
export async function issueRequest(form: FormData) {
  const s = await requireRole("admin");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const rows = await sql`
    SELECT c.code_hash FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash WHERE c.id = ${id} AND v.id IS NULL`;
  if (!rows.length) return;
  const [{ n }] = await sql`SELECT nextval('vcode_counter')::float8 AS n`;
  await sql`
    INSERT INTO verifications (code_hash, vcode, issued_by)
    VALUES (${rows[0].code_hash}, ${vcodeFromCounter(Number(n))}, ${s.uid})
    ON CONFLICT (code_hash) DO NOTHING`;
  await sql`UPDATE codes SET pending_enc = NULL WHERE id = ${id}`;
  revalidatePath("/admin");
}

// Monitor (and admin): scan the 10-digit number, get the verification code.
export async function lookupVerification(_: State, form: FormData): Promise<State> {
  await requireRole("monitor", "admin");
  const code = String(form.get("code") ?? "").trim();
  if (!CODE_RE.test(code)) return { error: "Not a valid 10-digit number" };
  const rows = await sql`SELECT vcode FROM verifications WHERE code_hash = ${hashCode(code)}`;
  if (!rows.length) return { error: "No verification code issued for this number yet" };
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
