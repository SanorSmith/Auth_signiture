import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";
import { createUser } from "@/lib/user-actions";

// Creates an account. You can only give permissions you hold, and only an administrator can create
// administrators; the new person chooses their own password at first sign-in.
export async function POST(req: Request) {
  const me = await guard("create_users");
  if (isResponse(me)) return me;
  const b = await readBody<{ email?: string; password?: string; admin?: boolean; perms?: string[] }>(req);
  return fromState(await createUser(null, toForm({ email: b.email, password: b.password, admin: b.admin ? "on" : undefined, perm: b.perms ?? [] })));
}
