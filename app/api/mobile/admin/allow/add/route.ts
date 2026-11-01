import { addAllowed, autoCodesOn, listAllowed } from "@/lib/allow-list";
import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";

export async function POST(req: Request) {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
  const { name } = await readBody<{ name?: string }>(req);
  const result = await addAllowed(name, me.email);
  if ("error" in result) return reply({ error: result.error }, 400);
  return json({ suppliers: await listAllowed(), enabled: await autoCodesOn() });
}
