import { sql } from "./db";
import { bucketStart, nextBucket, type Unit } from "./counter";

// Statistics of the code requests: how many numbers were scanned for a code, how many codes the admins
// issued and how many requests they denied, per day, week or month. They are counted from the requests
// that exist now, so a request an admin removed is no longer in them.

export type RequestBucket = { start: string; requested: number; issued: number; denied: number };
export type Requester = { email: string; requested: number };
export type RequestStats = {
  unit: Unit;
  from: string;
  to: string;
  buckets: RequestBucket[];
  requested: number;
  issued: number;
  denied: number;
  waiting: number; // right now, whatever the period
  requesters: Requester[]; // who asked for the most codes in the period
};

export async function requestStats(range: { unit: Unit; from: string; to: string }): Promise<RequestStats> {
  const { unit, from, to } = range;

  const requested = await sql`
    SELECT to_char(date_trunc(${unit}, created_at AT TIME ZONE 'Europe/Stockholm'), 'YYYY-MM-DD') AS start, count(*)::int AS n
    FROM codes
    WHERE (created_at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date AND (created_at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
    GROUP BY 1`;
  const issued = await sql`
    SELECT to_char(date_trunc(${unit}, created_at AT TIME ZONE 'Europe/Stockholm'), 'YYYY-MM-DD') AS start, count(*)::int AS n
    FROM verifications
    WHERE (created_at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date AND (created_at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
    GROUP BY 1`;
  const denied = await sql`
    SELECT to_char(date_trunc(${unit}, denied_at AT TIME ZONE 'Europe/Stockholm'), 'YYYY-MM-DD') AS start, count(*)::int AS n
    FROM codes
    WHERE denied_at IS NOT NULL
      AND (denied_at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date AND (denied_at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
    GROUP BY 1`;
  const who = await sql`
    SELECT COALESCE(u.email, c.requested_by_email, '?') AS email, count(*)::int AS n
    FROM codes c LEFT JOIN users u ON u.id = c.client_id
    WHERE (c.created_at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date AND (c.created_at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
    GROUP BY 1 ORDER BY n DESC, email LIMIT 10`;
  const waiting = await sql`
    SELECT count(*)::int AS n FROM codes c
    WHERE c.denied_at IS NULL AND NOT EXISTS (SELECT 1 FROM verifications v WHERE v.code_hash = c.code_hash)`;

  const map = (rows: Record<string, unknown>[]) => new Map(rows.map((r) => [r.start as string, r.n as number]));
  const [rq, is, dn] = [map(requested), map(issued), map(denied)];
  const buckets: RequestBucket[] = [];
  for (let s = bucketStart(from, unit); s <= to; s = nextBucket(s, unit)) {
    buckets.push({ start: s, requested: rq.get(s) ?? 0, issued: is.get(s) ?? 0, denied: dn.get(s) ?? 0 });
  }
  const sum = (pick: (b: RequestBucket) => number) => buckets.reduce((n, b) => n + pick(b), 0);
  return {
    unit,
    from,
    to,
    buckets,
    requested: sum((b) => b.requested),
    issued: sum((b) => b.issued),
    denied: sum((b) => b.denied),
    waiting: waiting[0].n as number,
    requesters: who.map((r) => ({ email: r.email as string, requested: r.n as number })),
  };
}
