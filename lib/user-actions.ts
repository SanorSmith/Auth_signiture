"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { canManageTarget, effectivePermissions, parsePermissions } from "./permissions";
import { requireAdmin, requirePermission } from "./session";
import type { State } from "./actions";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const refresh = () => {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
};

async function targetOf(id: number) {
  const rows = await sql`SELECT id, role, permissions FROM users WHERE id = ${id}`;
  if (!rows.length) return null;
  const role = rows[0].role as string;
  return { id: rows[0].id as number, role, perms: effectivePermissions(role, rows[0].permissions as string[]) };
}

// Creates an account; the user must choose their own password at first login. You can only give
// permissions you hold yourself, and only an administrator can create administrators.
export async function createUser(_: State, form: FormData): Promise<State> {
  const me = await requirePermission("create_users");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const wantsAdmin = form.get("admin") === "on";
  const perms = parsePermissions(form.getAll("perm"));
  if (!EMAIL_RE.test(email)) return { error: "Invalid email" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (wantsAdmin && !me.isAdmin) return { error: "Only an administrator can create administrators" };
  if (!wantsAdmin) {
    if (perms.length === 0) return { error: "Choose at least one permission" };
    if (perms.some((p) => !me.perms.includes(p))) return { error: "You can only give permissions you have yourself" };
  }
  const stored = wantsAdmin ? [] : perms;
  const rows = await sql`
    INSERT INTO users (email, password_hash, role, permissions, must_change)
    VALUES (${email}, ${await bcrypt.hash(password, 10)}, ${wantsAdmin ? "admin" : "user"}, ${stored}::text[], true)
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  refresh();
  return rows.length ? { ok: `Created ${email}. They choose a new password at first login.` } : { error: "Email already exists" };
}

// Administrators only: change a user's email and permissions.
export async function updateUser(_: State, form: FormData): Promise<State> {
  const me = await requireAdmin();
  const id = Number(form.get("id"));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const wantsAdmin = form.get("admin") === "on";
  const perms = parsePermissions(form.getAll("perm"));
  if (!Number.isInteger(id)) return { error: "Invalid user" };
  if (!EMAIL_RE.test(email)) return { error: "Invalid email" };
  if (id === me.uid && !wantsAdmin) return { error: "You can't remove your own administrator access" };
  if (!wantsAdmin && perms.length === 0) return { error: "Choose at least one permission" };
  const taken = await sql`SELECT 1 FROM users WHERE email = ${email} AND id <> ${id}`;
  if (taken.length) return { error: "Email already exists" };
  const stored = wantsAdmin ? [] : perms;
  const rows = await sql`
    UPDATE users SET email = ${email}, role = ${wantsAdmin ? "admin" : "user"}, permissions = ${stored}::text[]
    WHERE id = ${id} RETURNING id`;
  refresh();
  return rows.length ? { ok: "Saved" } : { error: "User not found" };
}

export async function deleteUser(_: State, form: FormData): Promise<State> {
  const me = await requirePermission("remove_users");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid user" };
  if (id === me.uid) return { error: "You can't delete your own account" };
  const target = await targetOf(id);
  if (!target) return { error: "User not found" };
  if (!canManageTarget(me, target)) return { error: "You can't remove administrators or other user managers" };
  await sql`DELETE FROM users WHERE id = ${id}`;
  refresh();
  return { ok: "Deleted" };
}

// Sets a random temporary password, signs the user out everywhere and forces a new password at next login.
export async function resetPassword(_: State, form: FormData): Promise<State> {
  const me = await requirePermission("reset_passwords");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid user" };
  const target = await targetOf(id);
  if (!target) return { error: "User not found" };
  if (!canManageTarget(me, target)) return { error: "You can't reset the password of administrators or other user managers" };
  const temp = randomBytes(9).toString("base64url");
  await sql`
    UPDATE users SET password_hash = ${await bcrypt.hash(temp, 10)}, must_change = true, token_version = token_version + 1
    WHERE id = ${id}`;
  await sql`UPDATE reset_requests SET handled_at = now() WHERE user_id = ${id} AND handled_at IS NULL`;
  refresh();
  return { ok: "Temporary password (shown once):", code: temp };
}
