"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { requireRole } from "./session";
import type { State } from "./actions";

const ROLES = ["admin", "client", "monitor"];
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const refresh = () => {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
};

// Admin creates an account; the user must choose their own password at first login.
export async function createUser(_: State, form: FormData): Promise<State> {
  await requireRole("admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "");
  if (!EMAIL_RE.test(email)) return { error: "Invalid email" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (!ROLES.includes(role)) return { error: "Invalid role" };
  const rows = await sql`
    INSERT INTO users (email, password_hash, role, must_change)
    VALUES (${email}, ${await bcrypt.hash(password, 10)}, ${role}, true)
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  refresh();
  return rows.length ? { ok: `Created ${role} ${email}. They choose a new password at first login.` } : { error: "Email already exists" };
}

export async function updateUser(_: State, form: FormData): Promise<State> {
  const me = await requireRole("admin");
  const id = Number(form.get("id"));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "");
  if (!Number.isInteger(id)) return { error: "Invalid user" };
  if (!EMAIL_RE.test(email)) return { error: "Invalid email" };
  if (!ROLES.includes(role)) return { error: "Invalid role" };
  if (id === me.uid && role !== "admin") return { error: "You can't change your own role" };
  const taken = await sql`SELECT 1 FROM users WHERE email = ${email} AND id <> ${id}`;
  if (taken.length) return { error: "Email already exists" };
  const rows = await sql`UPDATE users SET email = ${email}, role = ${role} WHERE id = ${id} RETURNING id`;
  refresh();
  return rows.length ? { ok: "Saved" } : { error: "User not found" };
}

export async function deleteUser(_: State, form: FormData): Promise<State> {
  const me = await requireRole("admin");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid user" };
  if (id === me.uid) return { error: "You can't delete your own account" };
  await sql`DELETE FROM users WHERE id = ${id}`;
  refresh();
  return { ok: "Deleted" };
}

// Sets a random temporary password, signs the user out everywhere and forces a new password at next login.
export async function resetPassword(_: State, form: FormData): Promise<State> {
  await requireRole("admin");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid user" };
  const temp = randomBytes(9).toString("base64url");
  const rows = await sql`
    UPDATE users SET password_hash = ${await bcrypt.hash(temp, 10)}, must_change = true, token_version = token_version + 1
    WHERE id = ${id} RETURNING id`;
  if (!rows.length) return { error: "User not found" };
  await sql`UPDATE reset_requests SET handled_at = now() WHERE user_id = ${id} AND handled_at IS NULL`;
  refresh();
  return { ok: "Temporary password (shown once):", code: temp };
}
