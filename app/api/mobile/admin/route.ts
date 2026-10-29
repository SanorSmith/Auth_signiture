import { plainNote } from "@/lib/codes";
import { sql } from "@/lib/db";
import { decryptPending } from "@/lib/codes";
import { guard, isResponse, json } from "@/lib/mobile";

function numberOf(blob: string | null) {
  try {
    return blob ? decryptPending(blob) : null;
  } catch {
    return null;
  }
}

// The admin screen: waiting requests (with the scanned number), the last three issued codes, and totals.
export async function GET() {
  const me = await guard("manage_requests");
  if (isResponse(me)) return me;
  const canSeeResets = me.perms.includes("reset_passwords");

  const pending = await sql`
    SELECT c.id, c.pending_enc, c.note, c.created_at, COALESCE(u.email, c.requested_by_email) AS email FROM codes c
    LEFT JOIN users u ON u.id = c.client_id
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE v.id IS NULL AND c.denied_at IS NULL ORDER BY c.id`;
  const issued = await sql`
    SELECT c.id, c.note, v.vcode, v.created_at,
           COALESCE(u.email, c.requested_by_email) AS email,
           COALESCE(i.email, v.issued_by_email) AS issuer
    FROM verifications v
    JOIN codes c ON c.code_hash = v.code_hash
    LEFT JOIN users u ON u.id = c.client_id
    LEFT JOIN users i ON i.id = v.issued_by
    ORDER BY v.id DESC LIMIT 3`;
  const totals = await sql`
    SELECT (SELECT count(*)::int FROM verifications) AS issued,
           (SELECT count(*)::int FROM reset_requests WHERE handled_at IS NULL) AS resets`;

  return json({
    pending: pending.map((r) => ({
      id: r.id as number,
      number: numberOf(r.pending_enc as string | null),
      askedBy: (r.email as string | null) ?? null,
      note: plainNote((r.note as string | null) ?? null),
      at: new Date(r.created_at as string).getTime(),
    })),
    issued: issued.map((r) => ({
      id: r.id as number,
      vcode: String(r.vcode).trim(),
      askedBy: (r.email as string | null) ?? null,
      issuedBy: (r.issuer as string | null) ?? null,
      note: plainNote((r.note as string | null) ?? null),
      at: new Date(r.created_at as string).getTime(),
    })),
    totals: { issued: totals[0].issued as number, resets: canSeeResets ? (totals[0].resets as number) : null },
  });
}
