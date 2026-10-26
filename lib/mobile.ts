import { NextResponse } from "next/server";
import type { Permission } from "./permissions";
import { getT } from "./lang";
import { currentUser } from "./session";

// Helpers for the Android app's API (/api/mobile/*). The app signs in once, keeps a token and sends
// it as a Bearer header; the same permission rules as the website then apply to every call.

export type MobileUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Like json, for replies with a message: the text is translated into the app's language (Accept-Language).
export async function reply(body: Record<string, unknown>, status = 200) {
  const t = await getT();
  const out = { ...body };
  for (const k of ["error", "message"]) if (typeof out[k] === "string") out[k] = t(out[k] as string);
  return json(out, status);
}

// The signed-in user, or the response to send back instead (401 not signed in, 403 not allowed).
export async function guard(...needed: Permission[]): Promise<MobileUser | NextResponse> {
  const me = await currentUser();
  if (!me) return reply({ error: "Not signed in" }, 401);
  if (me.mustChange) return reply({ error: "Choose a new password first", code: "password_change_required" }, 403);
  if (needed.length > 0 && !needed.some((p) => me.perms.includes(p))) return reply({ error: "Not allowed" }, 403);
  return me;
}

export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;

export const userShape = (me: MobileUser) => ({
  id: me.uid,
  email: me.email,
  isAdmin: me.isAdmin,
  perms: me.perms,
  mustChange: me.mustChange,
});

export async function readBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

// Builds the FormData the existing actions expect from a JSON body.
export function toForm(fields: Record<string, unknown>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, String(x)));
    else if (v !== undefined && v !== null) f.append(k, String(v));
  }
  return f;
}

// Turns an action's result into the API reply.
export async function fromState(state: { error?: string; ok?: string; code?: string; vcode?: string } | null) {
  if (state?.error) return reply({ error: state.error }, 400);
  return reply({ ok: true, message: state?.ok ?? null, code: state?.code ?? null, vcode: state?.vcode ?? null });
}
