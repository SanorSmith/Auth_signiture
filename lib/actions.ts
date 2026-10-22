"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { later, notifyPermission, notifyUsers, type Notice } from "./notify";
import { sql } from "./db";
import { blockedFor, clear, recordFailure } from "./ratelimit";
import { CODE_RE, NOTE_MAX, encryptPending, hashCode, vcodeFromCounter } from "./codes";
import { effectivePermissions, homeFor } from "./permissions";
import { createSession, destroySession, requirePermission } from "./session";

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

  const rows = await sql`SELECT id, password_hash, role, permissions, token_version, must_change FROM users WHERE email = ${email}`;
  const u = rows[0];
  // Compare even when the user is missing so response time doesn't reveal valid emails.
  const hash = u?.password_hash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
  const ok = await bcrypt.compare(password, hash);
  if (!u || !ok) {
    await Promise.all([recordFailure(emailKey), recordFailure(ipKey)]);
    return { error: "Wrong email or password" };
  }
  await clear(emailKey);
  await createSession({ uid: u.id, email, role: u.role as string, v: u.token_version });
  redirect(u.must_change ? "/account" : homeFor(effectivePermissions(u.role, u.permissions)));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// Tells everyone who manages requests that a request is waiting.
function announce(userId: number, email: string, note: string | null) {
  later(() =>
    notifyPermission(
      "manage_requests",
      { kind: "new_request", title: "New verification request", body: note ? `${email}: ${note}` : `From ${email}`, url: "/admin" },
      userId,
    ),
  );
}

// Tells the person who asked what the admin did with their request (not when they did it themselves).
function tellRequester(clientId: number | null, actorId: number, notice: Notice) {
  if (clientId && clientId !== actorId) later(() => notifyUsers([clientId], notice));
}

// Client: scan a 10-digit number to request its verification code. The number is kept
// encrypted only until the admin issues the code; afterwards just its keyed hash remains.
export async function requestVerification(_: State, form: FormData): Promise<State> {
  const s = await requirePermission("request");
  const code = String(form.get("code") ?? "").trim();
  if (!CODE_RE.test(code)) return { error: "Not a valid 10-digit number" };
  const note = String(form.get("note") ?? "").trim().slice(0, NOTE_MAX) || null;
  const h = hashCode(code);

  const found = await sql`
    SELECT c.client_id, c.denied_at, v.vcode FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash WHERE c.code_hash = ${h}`;
  if (found.length) {
    if (found[0].client_id !== s.uid) return { error: "This number has already been requested" };
    if (found[0].denied_at) {
      // Scanning a denied number again reopens the request for the admin.
      await sql`
        UPDATE codes SET denied_at = NULL, pending_enc = ${encryptPending(code)}, last_scanned_at = now(),
                         note = COALESCE(${note}, note)
        WHERE code_hash = ${h}`;
      revalidatePath("/client");
      revalidatePath("/admin");
      announce(s.uid, s.email, note);
      return { ok: "Request sent again, waiting for the admin" };
    }
    // Re-scanning your own number makes it the one the client page shows.
    await sql`UPDATE codes SET last_scanned_at = now(), note = COALESCE(${note}, note) WHERE code_hash = ${h}`;
    revalidatePath("/client");
    return { ok: found[0].vcode ? "Verification code shown below" : "Already requested, waiting for the admin" };
  }
  const ins = await sql`
    INSERT INTO codes (code_hash, client_id, requested_by_email, pending_enc, note)
    VALUES (${h}, ${s.uid}, ${s.email}, ${encryptPending(code)}, ${note})
    ON CONFLICT (code_hash) DO NOTHING RETURNING id`;
  revalidatePath("/client");
  if (ins.length) announce(s.uid, s.email, note);
  return ins.length ? { ok: "Request sent, waiting for the admin" } : { error: "This number has already been requested" };
}

// How many of the oldest requests are dropped at once when the code space is used up.
const PRUNE_BATCH = Number(process.env.VCODE_PRUNE_BATCH) > 0 ? Number(process.env.VCODE_PRUNE_BATCH) : 1000;

// Codes are handed out in a cycle of 2.6 million. Once every one is in use, the next code is still
// held by an older request. Then the oldest PRUNE_BATCH requests (code and request together) are
// deleted to make room, and the same happens again each time the space fills up.
async function makeRoom(vcode: string) {
  const holder = async () => (await sql`SELECT id, code_hash FROM verifications WHERE vcode = ${vcode} LIMIT 1`)[0];
  if (!(await holder())) return;
  await sql`
    WITH old AS (SELECT id FROM verifications ORDER BY id ASC LIMIT ${PRUNE_BATCH}),
         gone AS (DELETE FROM verifications WHERE id IN (SELECT id FROM old) RETURNING code_hash)
    DELETE FROM codes WHERE code_hash IN (SELECT code_hash FROM gone)`;
  // After requests were removed by hand the holder may not be among the oldest: drop it too, so a code is never in use twice.
  const still = await holder();
  if (still) {
    await sql`DELETE FROM verifications WHERE id = ${still.id}`;
    await sql`DELETE FROM codes WHERE code_hash = ${still.code_hash}`;
  }
}

// Admin: generate the next letter + 5 digit code for a pending request, then wipe the stored number.
export async function issueRequest(form: FormData) {
  const s = await requirePermission("manage_requests");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const rows = await sql`
    SELECT c.code_hash, c.client_id FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash WHERE c.id = ${id} AND v.id IS NULL AND c.denied_at IS NULL`;
  if (!rows.length) return;
  const [{ n }] = await sql`SELECT nextval('vcode_counter')::float8 AS n`;
  const vcode = vcodeFromCounter(Number(n));
  await makeRoom(vcode);
  await sql`
    INSERT INTO verifications (code_hash, vcode, issued_by, issued_by_email)
    VALUES (${rows[0].code_hash}, ${vcode}, ${s.uid}, ${s.email})
    ON CONFLICT (code_hash) DO NOTHING`;
  await sql`UPDATE codes SET pending_enc = NULL WHERE id = ${id}`;
  revalidatePath("/admin");
  revalidatePath("/client");
  // The code itself is not put in the notification, so it never shows on a lock screen.
  tellRequester(rows[0].client_id, s.uid, {
    kind: "code_issued",
    title: "Your verification code is ready",
    body: "The admin issued the code for your request.",
    url: "/client",
  });
}

// Admin: refuse a pending request. The stored number is wiped; the client sees it was denied.
export async function denyRequest(_: State, form: FormData): Promise<State> {
  const me = await requirePermission("manage_requests");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid request" };
  const rows = await sql`
    UPDATE codes SET denied_at = now(), pending_enc = NULL
    WHERE id = ${id} AND denied_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM verifications v WHERE v.code_hash = codes.code_hash)
    RETURNING id, client_id`;
  revalidatePath("/admin");
  revalidatePath("/client");
  if (rows.length) {
    tellRequester(rows[0].client_id, me.uid, {
      kind: "request_denied",
      title: "Your request was denied",
      body: "The admin denied your request. Scan the number again to ask once more.",
      url: "/client",
    });
  }
  return rows.length ? { ok: "Denied" } : { error: "This request was already handled" };
}

// Admin: delete a confirmed request. Its code stops working on the monitor and leaves the client's history.
export async function removeRequest(_: State, form: FormData): Promise<State> {
  const me = await requirePermission("manage_requests");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid request" };
  const rows = await sql`SELECT code_hash, client_id FROM codes WHERE id = ${id}`;
  if (!rows.length) return { error: "Request not found" };
  await sql`DELETE FROM verifications WHERE code_hash = ${rows[0].code_hash}`;
  await sql`DELETE FROM codes WHERE id = ${id}`;
  revalidatePath("/admin");
  revalidatePath("/client");
  tellRequester(rows[0].client_id, me.uid, {
    kind: "request_removed",
    title: "Your request was removed",
    body: "The admin removed one of your requests.",
    url: "/client",
  });
  return { ok: "Removed" };
}

// Monitor (and admin): scan the 10-digit number, get the verification code.
export async function lookupVerification(_: State, form: FormData): Promise<State> {
  await requirePermission("monitor");
  const code = String(form.get("code") ?? "").trim();
  if (!CODE_RE.test(code)) return { error: "Not a valid 10-digit number" };
  const rows = await sql`SELECT vcode FROM verifications WHERE code_hash = ${hashCode(code)}`;
  if (!rows.length) return { error: "No verification code issued for this number yet" };
  return { vcode: rows[0].vcode.trim() };
}

