import { autoCodesOn, listAllowed, setSupplierActive } from "@/lib/allow-list";
import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";

// Pause or resume one supplier on the allow list.
export async function POST(req: Request) {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
  const { id, active } = await readBody<{ id?: number; active?: boolean }>(req);
  if (!Number.isInteger(id) || typeof active !== "boolean") return reply({ error: "Invalid request" }, 400);
  await setSupplierActive(id as number, active);
  return json({ suppliers: await listAllowed(), enabled: await autoCodesOn() });
}
