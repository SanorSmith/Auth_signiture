import { type NextRequest } from "next/server";
import {
  counterAdjust,
  counterCancel,
  counterFinish,
  counterResolve,
  counterScan,
  counterSetExpected,
  counterState,
  counterStats,
  counterUndo,
  parseRange,
  previousRange,
} from "@/lib/counter";
import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";

// The colli counter for the Android app. Everything except the statistics is about the signed-in
// person's own open count.
type Ctx = { params: Promise<{ action: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const me = await guard("colli_counter");
  if (isResponse(me)) return me;
  const { action } = await params;
  if (action === "state") return json(await counterState(me.uid));
  if (action === "stats") {
    const q = req.nextUrl.searchParams;
    const range = parseRange({ unit: q.get("unit"), from: q.get("from"), to: q.get("to") });
    const onlyMine = q.get("mine") === "1" ? me.uid : null;
    const current = await counterStats(range, onlyMine);
    const compare = q.get("compare") === "0" ? null : await counterStats(previousRange(range), onlyMine);
    return json({ current, compare });
  }
  return reply({ error: "Not found" }, 404);
}

export async function POST(req: Request, { params }: Ctx) {
  const me = await guard("colli_counter");
  if (isResponse(me)) return me;
  const { action } = await params;
  const body = await readBody<{ code?: string; choice?: string; delta?: number; expected?: number | null }>(req);
  switch (action) {
    case "scan":
      return json(await counterScan(me.uid, body.code));
    case "resolve": {
      const choice = body.choice === "count" || body.choice === "new" ? body.choice : "ignore";
      const result = await counterResolve(me.uid, me.email, body.code, choice);
      return "error" in result ? reply({ error: result.error }, 400) : json(result);
    }
    case "adjust":
      return json(await counterAdjust(me.uid, Number(body.delta) || 0));
    case "expected":
      return json(await counterSetExpected(me.uid, body.expected === null || body.expected === undefined ? null : Number(body.expected)));
    case "undo":
      return json(await counterUndo(me.uid));
    case "cancel":
      return json(await counterCancel(me.uid));
    case "finish": {
      const result = await counterFinish(me.uid, me.email);
      return "error" in result ? reply({ error: result.error }, 400) : json(result);
    }
  }
  return reply({ error: "Not found" }, 404);
}
