import { changePasswordFor } from "@/lib/auth";
import { json, readBody, userShape } from "@/lib/mobile";
import { currentUser, signToken } from "@/lib/session";

// Change the password (also clears a forced change after an admin reset). Every other session is
// signed out, so the app receives a fresh token to keep going.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return json({ error: "Not signed in" }, 401);
  const b = await readBody<{ current?: string; next?: string; confirm?: string }>(req);

  const result = await changePasswordFor(me.uid, String(b.current ?? ""), String(b.next ?? ""), String(b.confirm ?? b.next ?? ""));
  if ("error" in result) return json({ error: result.error }, result.error.startsWith("Too many") ? 429 : 400);

  const token = await signToken({ uid: me.uid, email: me.email, role: me.role, v: result.version }, "30d");
  return json({ token, user: { ...userShape(me), mustChange: false } });
}
