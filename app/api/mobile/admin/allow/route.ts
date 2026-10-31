import { listAllowed } from "@/lib/allow-list";
import { guard, isResponse, json, reply } from "@/lib/mobile";

// The allow list: administrators only.
export async function GET() {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
  return json({ suppliers: await listAllowed() });
}
