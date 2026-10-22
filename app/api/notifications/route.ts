import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/session";

type Row = { id: number; kind: string; title: string; body: string; url: string; created_at: string; read_at: string | null };

const shape = (r: Row) => ({
  id: Number(r.id),
  kind: r.kind,
  title: r.title,
  body: r.body,
  url: r.url,
  at: new Date(r.created_at).getTime(),
  read: r.read_at !== null,
});

// The signed-in person's notifications. `?list=1` returns the latest ones for the bell;
// `?after=<id>` returns only what arrived since, which is what the open app polls for.
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me || me.mustChange) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const after = Number(params.get("after"));
  const unread = (await sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${me.uid} AND read_at IS NULL`)[0].n as number;

  const rows =
    params.get("list") || !Number.isFinite(after)
      ? await sql`SELECT * FROM notifications WHERE user_id = ${me.uid} ORDER BY id DESC LIMIT 15`
      : await sql`SELECT * FROM notifications WHERE user_id = ${me.uid} AND id > ${after} ORDER BY id ASC LIMIT 20`;

  const latest = await sql`SELECT COALESCE(max(id), 0) AS id FROM notifications WHERE user_id = ${me.uid}`;
  return NextResponse.json(
    { items: (rows as Row[]).map(shape), unread, latestId: Number(latest[0].id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
