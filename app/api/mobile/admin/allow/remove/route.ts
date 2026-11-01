import { autoCodesOn, listAllowed, removeAllowed } from "@/lib/allow-list";
import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";

export async function POST(req: Request) {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
  const { id } = await readBody<{ id?: number }>(req);
  if (!Number.isInteger(id)) return reply({ error: "Invalid request" }, 400);
  await removeAllowed(id as number);
  return json({ suppliers: await listAllowed(), enabled: await autoCodesOn() });
}
