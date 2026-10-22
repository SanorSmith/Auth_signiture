import { NextResponse, type NextRequest } from "next/server";
import { notificationFeed } from "@/lib/notifications-feed";
import { currentUser } from "@/lib/session";

// The signed-in person's notifications. `?list=1` returns the latest ones for the bell;
// `?after=<id>` returns only what arrived since, which is what the open app polls for.
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me || me.mustChange) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const feed = await notificationFeed(me.uid, { list: params.get("list") !== null, after: Number(params.get("after")) });
  return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
}
