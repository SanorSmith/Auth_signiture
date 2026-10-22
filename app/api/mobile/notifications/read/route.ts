import { guard, isResponse, json } from "@/lib/mobile";
import { markNotificationsRead } from "@/lib/push-actions";

// Marks everything as read once the person has looked at it.
export async function POST() {
  const me = await guard();
  if (isResponse(me)) return me;
  await markNotificationsRead();
  return json({ ok: true });
}
