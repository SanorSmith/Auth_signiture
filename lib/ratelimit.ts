import { sql } from "./db";

export const WINDOW_MIN = 15;

// Seconds until the key is allowed again, or 0 if it is under the limit.
export async function blockedFor(key: string, limit: number) {
  const rows = await sql`
    SELECT count, GREATEST(0, CEIL(EXTRACT(EPOCH FROM reset_at - now())))::int AS wait
    FROM rate_limits WHERE key = ${key} AND reset_at > now()`;
  return rows.length && rows[0].count >= limit ? (rows[0].wait as number) : 0;
}

export async function recordFailure(key: string) {
  await sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(mins => ${WINDOW_MIN}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < now()
                      THEN now() + make_interval(mins => ${WINDOW_MIN}) ELSE rate_limits.reset_at END`;
}

export async function clear(key: string) {
  await sql`DELETE FROM rate_limits WHERE key = ${key}`;
}
