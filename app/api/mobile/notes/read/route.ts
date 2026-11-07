import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";
import { readNoteTable } from "@/lib/note-table";
import { blockedFor, recordFailure } from "@/lib/ratelimit";

// Reads one photo (one page) of a delivery note into table rows. A photo is up to a few MB; reading one takes
// several seconds. Nothing is stored: not the photo, not the rows.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 4_000_000; // base64 text, about 3 MB of image
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const READS_PER_WINDOW = 60; // per person, per 15 minutes (one per page): each one costs money

export async function POST(req: Request) {
  const me = await guard("note_table");
  if (isResponse(me)) return me;
  if (!process.env.ANTHROPIC_API_KEY) return reply({ error: "Reading delivery notes is not set up yet. An administrator must add the AI key." }, 503);
  const body = await readBody<{ image?: string; mediaType?: string }>(req);
  if (typeof body.image !== "string" || body.image.length < 100) return reply({ error: "Not a supported photo" }, 400);
  if (body.image.length > MAX_IMAGE_CHARS) return reply({ error: "The photo is too large" }, 413);
  const mediaType = body.mediaType ?? "image/jpeg";
  if (!IMAGE_TYPES.has(mediaType)) return reply({ error: "Not a supported photo" }, 400);
  const key = `table:${me.uid}`;
  const wait = await blockedFor(key, READS_PER_WINDOW);
  if (wait) return reply({ error: `Too many delivery notes read. Try again in ${Math.ceil(wait / 60)} min.` }, 429);
  await recordFailure(key); // counts the attempt, whatever happens next
  const table = await readNoteTable(body.image, mediaType);
  return "error" in table ? reply({ error: table.error }, 502) : json(table);
}
