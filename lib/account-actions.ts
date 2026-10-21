"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { blockedFor, clear, recordFailure } from "./ratelimit";
import { createSession, homeFor, requireUser } from "./session";
import type { State } from "./actions";

// Any signed-in user changes their own password; this also clears a forced change after an admin reset.
export async function changePassword(_: State, form: FormData): Promise<State> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const key = `pw:${me.uid}`;
  const wait = await blockedFor(key, 5);
  if (wait) return { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` };

  const rows = await sql`SELECT password_hash FROM users WHERE id = ${me.uid}`;
  if (!rows.length || !(await bcrypt.compare(current, rows[0].password_hash))) {
    await recordFailure(key);
    return { error: "Current password is wrong" };
  }
  if (next.length < 8) return { error: "New password must be at least 8 characters" };
  if (next !== confirm) return { error: "The new passwords don't match" };
  if (next === current) return { error: "Choose a password you haven't used just now" };

  const updated = await sql`
    UPDATE users SET password_hash = ${await bcrypt.hash(next, 10)}, must_change = false, token_version = token_version + 1
    WHERE id = ${me.uid} RETURNING token_version`;
  await clear(key);
  // Other sessions are signed out by the version bump; keep this one.
  await createSession({ uid: me.uid, email: me.email, role: me.role, v: updated[0].token_version });
  revalidatePath("/", "layout");
  redirect(homeFor(me.role));
}

// Public: asks the admin to reset an account's password. The answer never reveals whether the email exists.
export async function forgotPassword(_: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const key = `forgot-ip:${ip}`;
  const wait = await blockedFor(key, 5);
  if (wait) return { error: `Too many requests. Try again in ${Math.ceil(wait / 60)} min.` };
  await recordFailure(key);

  const rows = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (rows.length) {
    await sql`
      INSERT INTO reset_requests (user_id) VALUES (${rows[0].id})
      ON CONFLICT (user_id) WHERE handled_at IS NULL DO NOTHING`;
    revalidatePath("/admin");
    revalidatePath("/admin/users");
  }
  return { ok: "If that account exists, the admin has been notified and will give you a temporary password." };
}
