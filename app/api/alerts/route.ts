import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/session";

// Polled by the open app: how many requests wait, and when the newest one arrived.
export async function GET() {
  const me = await currentUser();
  if (!me || me.mustChange || !me.perms.includes("manage_requests")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const rows = await sql`
    SELECT c.last_scanned_at AS at, COALESCE(u.email, c.requested_by_email) AS email, c.note,
           count(*) OVER ()::int AS pending
    FROM codes c
    LEFT JOIN users u ON u.id = c.client_id
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE v.id IS NULL AND c.denied_at IS NULL
    ORDER BY c.last_scanned_at DESC LIMIT 1`;
  const latest = rows[0];
  return NextResponse.json(
    {
      pending: latest ? (latest.pending as number) : 0,
      latestAt: latest ? new Date(latest.at as string).getTime() : 0,
      latest: latest ? { email: latest.email ?? "A client", note: latest.note ?? null } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
