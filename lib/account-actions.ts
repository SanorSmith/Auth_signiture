"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changePasswordFor } from "./auth";
import { sql } from "./db";
import { blockedFor, recordFailure } from "./ratelimit";
import { later, notifyPermission } from "./notify";
import { homeFor } from "./permissions";
import { createSession, requireUser } from "./session";
import type { State } from "./actions";

// Any signed-in user changes their own password; this also clears a forced change after an admin reset.
export async function changePassword(_: State, form: FormData): Promise<State> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const result = await changePasswordFor(me.uid, current, next, confirm);
  if ("error" in result) return { error: result.error };
  // Other sessions are signed out by the version bump; keep this one.
  await createSession({ uid: me.uid, email: me.email, role: me.role, v: result.version });
  revalidatePath("/", "layout");
  redirect(homeFor(me.perms));
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
    const added = await sql`
      INSERT INTO reset_requests (user_id) VALUES (${rows[0].id})
      ON CONFLICT (user_id) WHERE handled_at IS NULL DO NOTHING RETURNING id`;
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    // Only the first request notifies; asking again while one is open does not repeat it.
    if (added.length) {
      later(() =>
        notifyPermission(
          "reset_passwords",
          { kind: "reset_requested", title: "Password reset requested", body: `${email} asked for a password reset`, url: "/admin/users" },
          rows[0].id as number,
        ),
      );
    }
  }
  return { ok: "If that account exists, the admin has been notified and will give you a temporary password." };
}
