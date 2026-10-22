import { json, userShape } from "@/lib/mobile";
import { currentUser } from "@/lib/session";

// Who the app is signed in as, and what that person may do. Also answers when a password change is pending.
export async function GET() {
  const me = await currentUser();
  if (!me) return json({ error: "Not signed in" }, 401);
  return json({ user: userShape(me) });
}
