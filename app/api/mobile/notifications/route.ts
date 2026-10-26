import { type NextRequest } from "next/server";
import { getLang } from "@/lib/lang";
import { guard, isResponse, json } from "@/lib/mobile";
import { notificationFeed } from "@/lib/notifications-feed";

// The person's notifications: `?list=1` for the latest ones, `?after=<id>` for what is new since.
export async function GET(req: NextRequest) {
  const me = await guard();
  if (isResponse(me)) return me;
  const params = req.nextUrl.searchParams;
  return json(await notificationFeed(me.uid, { list: params.get("list") !== null, after: Number(params.get("after")), lang: await getLang() }));
}
