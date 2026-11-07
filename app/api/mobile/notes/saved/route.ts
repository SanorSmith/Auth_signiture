import { guard, isResponse, json, readBody, reply } from "@/lib/mobile";
import { cleanRows, listSaved, replaceSaved } from "@/lib/saved-note";

// The person's saved delivery note table: the phone sends it, the website shows it, either can clear it.
export async function GET() {
  const me = await guard("note_table");
  if (isResponse(me)) return me;
  return json({ rows: await listSaved(me.uid) });
}

// Replaces the saved table with the lines sent (the screen that sends them holds the whole table); no lines clears it.
export async function POST(req: Request) {
  const me = await guard("note_table");
  if (isResponse(me)) return me;
  const { rows } = await readBody<{ rows?: unknown }>(req);
  const clean = cleanRows(rows);
  if (!clean) return reply({ error: "Invalid request" }, 400);
  await replaceSaved(me.uid, clean);
  return json({ rows: clean });
}
