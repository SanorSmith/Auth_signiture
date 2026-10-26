import { sql } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { json, reply, userShape } from "@/lib/mobile";
import { currentUser } from "@/lib/session";

// Who the app is signed in as, and what that person may do. Also answers when a password change is pending.
export async function GET() {
  const me = await currentUser();
  if (!me) return reply({ error: "Not signed in" }, 401);
  // The app checks in regularly, so a language change on the phone reaches the notifications sent to it.
  await sql`UPDATE users SET lang = ${await getLang()} WHERE id = ${me.uid} AND lang IS DISTINCT FROM ${await getLang()}`;
  return json({ user: userShape(me) });
}
