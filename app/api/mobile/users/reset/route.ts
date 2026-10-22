import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";
import { resetPassword } from "@/lib/user-actions";

// Gives a user a temporary password (returned once in `code`) and signs them out everywhere.
export async function POST(req: Request) {
  const me = await guard("reset_passwords");
  if (isResponse(me)) return me;
  const { id } = await readBody<{ id?: number }>(req);
  return fromState(await resetPassword(null, toForm({ id })));
}
