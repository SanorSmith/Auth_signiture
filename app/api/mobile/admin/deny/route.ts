import { denyRequest } from "@/lib/actions";
import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";

// Denies a waiting request; the client is told.
export async function POST(req: Request) {
  const me = await guard("manage_requests");
  if (isResponse(me)) return me;
  const { id } = await readBody<{ id?: number }>(req);
  return fromState(await denyRequest(null, toForm({ id })));
}
