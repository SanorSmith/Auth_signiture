import { fromState, guard, isResponse, json, readBody, toForm } from "@/lib/mobile";
import { updateUser } from "@/lib/user-actions";

// Administrators only: change someone's email and permissions.
export async function POST(req: Request) {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return json({ error: "Not allowed" }, 403);
  const b = await readBody<{ id?: number; email?: string; admin?: boolean; perms?: string[] }>(req);
  return fromState(await updateUser(null, toForm({ id: b.id, email: b.email, admin: b.admin ? "on" : undefined, perm: b.perms ?? [] })));
}
