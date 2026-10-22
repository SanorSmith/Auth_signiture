import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";
import { deleteUser } from "@/lib/user-actions";

// Deletes an account (not your own, and not administrators or other user managers unless you are one).
export async function POST(req: Request) {
  const me = await guard("remove_users");
  if (isResponse(me)) return me;
  const { id } = await readBody<{ id?: number }>(req);
  return fromState(await deleteUser(null, toForm({ id })));
}
