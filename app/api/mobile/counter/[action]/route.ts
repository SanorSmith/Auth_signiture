import { type NextRequest } from "next/server";
import {
  counterAdjust,
  counterCancel,
  counterGroupAdjust,
  counterGroupExpected,
  counterMergeGroups,
  counterRemoveGroup,
  counterSetMode,
  deliveriesForCompare,
  counterFinish,
  counterResolve,
  counterScan,
  counterSetExpected,
  counterState,
  counterStats,
  counterUndo,
  noteCompareEnabled,
  parseRange,
  setNoteCompareEnabled,
  previousRange,
  scannedCodes,
} from "@/lib/counter";
import { cleanIds, compareDeliveries, compareSets, noteReadingConfigured, readDeliveryNote } from "@/lib/counter-note";
import { blockedFor, recordFailure } from "@/lib/ratelimit";
import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";

// The colli counter for the Android app. Everything except the statistics is about the signed-in
// person's own open count.
// A photo is up to a few MB; reading one takes several seconds.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 4_000_000; // base64 text, about 3 MB of image
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const NOTE_READS_PER_WINDOW = 40; // per person, per 15 minutes (one per page): each one costs money

type Ctx = { params: Promise<{ action: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const me = await guard("colli_counter");
  if (isResponse(me)) return me;
  const { action } = await params;
  if (action === "state") return json(await counterState(me.uid));
  if (action === "stats") {
    if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
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
  const body = await readBody<{ code?: string; choice?: string; delta?: number; expected?: number | null; image?: string; mediaType?: string; ids?: unknown; on?: boolean; multi?: boolean; group?: number | "all"; from?: number; into?: number }>(req);
  switch (action) {
    case "scan":
      return json(await counterScan(me.uid, body.code));
    case "resolve": {
      const choice = body.choice === "count" || body.choice === "new" || body.choice === "delivery" ? body.choice : "ignore";
      const result = await counterResolve(me.uid, me.email, body.code, choice);
      return "error" in result ? reply({ error: result.error }, 400) : json(result);
    }
    case "adjust":
      return json(await counterAdjust(me.uid, Number(body.delta) || 0));
    case "expected":
      return json(await counterSetExpected(me.uid, body.expected === null || body.expected === undefined ? null : Number(body.expected)));
    case "mode": {
      const result = await counterSetMode(me.uid, body.multi === true);
      return "error" in result ? reply({ error: result.error }, 400) : json(result.state);
    }
    case "group-adjust":
      return json(await counterGroupAdjust(me.uid, Number(body.group), Number(body.delta) || 0));
    case "group-expected":
      return json(await counterGroupExpected(me.uid, Number(body.group), body.expected === null || body.expected === undefined ? null : Number(body.expected)));
    case "group-merge":
      return json(await counterMergeGroups(me.uid, Number(body.from), Number(body.into)));
    case "group-remove":
      return json(await counterRemoveGroup(me.uid, Number(body.group)));
    case "note-setting": {
      if (!me.isAdmin) return reply({ error: "Not allowed" }, 403);
      await setNoteCompareEnabled(body.on === true);
      return json({ noteCompare: await noteCompareEnabled() });
    }
    case "note-read": {
      if (!(await noteCompareEnabled())) return reply({ error: "Comparing with a delivery note is turned off" }, 403);
      if (!noteReadingConfigured()) return reply({ error: "Reading delivery notes is not set up yet. An administrator must add the AI key." }, 503);
      if (typeof body.image !== "string" || body.image.length < 100) return reply({ error: "Not a supported photo" }, 400);
      if (body.image.length > MAX_IMAGE_CHARS) return reply({ error: "The photo is too large" }, 413);
      const mediaType = body.mediaType ?? "image/jpeg";
      if (!IMAGE_TYPES.has(mediaType)) return reply({ error: "Not a supported photo" }, 400);
      const key = `note:${me.uid}`;
      const wait = await blockedFor(key, NOTE_READS_PER_WINDOW);
      if (wait) return reply({ error: `Too many delivery notes read. Try again in ${Math.ceil(wait / 60)} min.` }, 429);
      await recordFailure(key); // counts the attempt, whatever happens next
      // Tell the reader what the scanned packages look like: two samples and their usual length.
      const only = typeof body.group === "number" ? body.group : null;
      const scanned = await scannedCodes(me.uid, only);
      let hint = scanned.length ? { samples: [...new Set([scanned[0], scanned[scanned.length - 1]])], length: scanned[0].length } : null;
      if (body.group === "all") {
        // A note that lists every delivery: show one sample of each, so the reader looks for all of them.
        const each = (await deliveriesForCompare(me.uid)).filter((d) => d.codes.length > 0);
        hint = each.length ? { samples: each.slice(0, 5).map((d) => d.codes[0]), length: each[0].codes[0].length } : null;
      }
      const reading = await readDeliveryNote(body.image, mediaType, hint);
      return "error" in reading ? reply({ error: reading.error }, 502) : json(reading);
    }
    case "note-compare": {
      if (!(await noteCompareEnabled())) return reply({ error: "Comparing with a delivery note is turned off" }, 403);
      const ids = cleanIds(Array.isArray(body.ids) ? body.ids : []);
      if (body.group === "all") {
        const deliveries = (await deliveriesForCompare(me.uid)).filter((d) => d.codes.length > 0);
        if (deliveries.length === 0) return reply({ error: "Nothing has been counted yet" }, 400);
        if (ids.length === 0) return reply({ error: "There are no package IDs to compare" }, 400);
        return json(compareDeliveries(ids, deliveries));
      }
      const scanned = await scannedCodes(me.uid, typeof body.group === "number" ? body.group : null);
      if (scanned.length === 0) return reply({ error: "Nothing has been counted yet" }, 400);
      if (ids.length === 0) return reply({ error: "There are no package IDs to compare" }, 400);
      return json(compareSets(ids, scanned));
    }
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
