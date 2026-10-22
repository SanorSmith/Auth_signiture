import { issueRequest } from "@/lib/actions";
import { guard, isResponse, json, readBody, toForm } from "@/lib/mobile";

// Generates the next verification code for a waiting request and tells the client.
export async function POST(req: Request) {
  const me = await guard("manage_requests");
  if (isResponse(me)) return me;
  const { id } = await readBody<{ id?: number }>(req);
  await issueRequest(toForm({ id }));
  return json({ ok: true });
}
