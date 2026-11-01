import { autoCodesOn, listAllowed, setAutoCodes } from "@/lib/allow-list";
import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";

// Pause or resume automatic codes as a whole: while paused, every request waits for an administrator.
export async function POST(req: Request) {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
  const { on } = await readBody<{ on?: boolean }>(req);
  if (typeof on !== "boolean") return reply({ error: "Invalid request" }, 400);
  await setAutoCodes(on);
  return json({ suppliers: await listAllowed(), enabled: await autoCodesOn() });
}
