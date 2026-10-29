import { plainNote } from "@/lib/codes";
import { sql } from "@/lib/db";
import { guard, isResponse, json } from "@/lib/mobile";

// The client screen: the code for the number scanned last, and the last three issued codes.
export async function GET() {
  const me = await guard("request");
  if (isResponse(me)) return me;

  const latestRows = await sql`
    SELECT v.vcode, c.denied_at FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${me.uid} ORDER BY c.last_scanned_at DESC, c.id DESC LIMIT 1`;
  const history = await sql`
    SELECT v.vcode, v.created_at, c.note FROM codes c
    JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${me.uid} ORDER BY v.id DESC LIMIT 3`;

  const latest = latestRows[0] as { vcode: string | null; denied_at: string | null } | undefined;
  const status = !latest ? "none" : latest.vcode ? "ready" : latest.denied_at ? "denied" : "waiting";
  return json({
    status,
    vcode: latest?.vcode?.trim() ?? null,
    history: history.map((h) => ({ vcode: String(h.vcode).trim(), at: new Date(h.created_at as string).getTime(), note: plainNote((h.note as string | null) ?? null) })),
  });
}
