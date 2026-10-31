import type { NextRequest } from "next/server";
import { parseRange, previousRange } from "@/lib/counter";
import { guard, isResponse, json, reply } from "@/lib/mobile";
import { requestStats } from "@/lib/request-stats";

// Request statistics for the app: administrators only.
export async function GET(req: NextRequest) {
  const me = await guard();
  if (isResponse(me)) return me;
  if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
  const q = req.nextUrl.searchParams;
  const range = parseRange({ unit: q.get("unit"), from: q.get("from"), to: q.get("to") });
  const current = await requestStats(range);
  const compare = q.get("compare") === "0" ? null : await requestStats(previousRange(range));
  return json({ current, compare });
}
