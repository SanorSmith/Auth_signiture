import { sql } from "./db";
import { bucketStart, nextBucket, type Unit } from "./counter";

// Statistics of the code requests, counted from the permanent log (request_events): how many numbers were
// scanned for a code, how many codes the admins issued, how many requests they denied and how many issued
// requests they removed, per day, week or month. Removing a request or an account does not change the figures.

export type RequestBucket = { start: string; requested: number; issued: number; denied: number; removed: number };
export type Requester = { email: string; requested: number };
export type RequestStats = {
  unit: Unit;
  from: string;
  to: string;
  buckets: RequestBucket[];
  requested: number;
  issued: number;
  denied: number;
  removed: number;
  waiting: number; // right now, whatever the period
  requesters: Requester[]; // who asked for the most codes in the period
};

export async function requestStats(range: { unit: Unit; from: string; to: string }): Promise<RequestStats> {
  const { unit, from, to } = range;

  const rows = await sql`
    SELECT to_char(date_trunc(${unit}, at AT TIME ZONE 'Europe/Stockholm'), 'YYYY-MM-DD') AS start, kind, count(*)::int AS n
    FROM request_events
    WHERE (at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date AND (at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
    GROUP BY 1, 2`;
  const who = await sql`
    SELECT COALESCE(client_email, '?') AS email, count(*)::int AS n
    FROM request_events
    WHERE kind = 'requested'
      AND (at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date AND (at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
    GROUP BY 1 ORDER BY n DESC, email LIMIT 10`;
  const waiting = await sql`
    SELECT count(*)::int AS n FROM codes c
    WHERE c.denied_at IS NULL AND NOT EXISTS (SELECT 1 FROM verifications v WHERE v.code_hash = c.code_hash)`;

  const found = new Map<string, number>(rows.map((r) => [`${r.start}|${r.kind}`, r.n as number]));
  const buckets: RequestBucket[] = [];
  for (let s = bucketStart(from, unit); s <= to; s = nextBucket(s, unit)) {
    const n = (kind: string) => found.get(`${s}|${kind}`) ?? 0;
    buckets.push({ start: s, requested: n("requested"), issued: n("issued"), denied: n("denied"), removed: n("removed") });
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
    removed: sum((b) => b.removed),
    waiting: waiting[0].n as number,
    requesters: who.map((r) => ({ email: r.email as string, requested: r.n as number })),
  };
}
