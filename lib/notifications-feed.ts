import { sql } from "./db";
import { plainNote } from "./codes";
import { makeT, type Lang } from "./i18n";

type Row = { id: number; kind: string; title: string; body: string; url: string; created_at: string; read_at: string | null };

export type FeedItem = { id: number; kind: string; title: string; body: string; url: string; at: number; read: boolean };

const shape = (r: Row, t: (s: string) => string): FeedItem => ({
  id: Number(r.id),
  kind: r.kind,
  title: t(r.title),
  body: t(plainNote(r.body)),
  url: r.url,
  at: new Date(r.created_at).getTime(),
  read: r.read_at !== null,
});

// One person's notifications. `list` returns the latest ones (newest first), otherwise only what
// arrived after id `after` (oldest first), which is what the website and the app poll for.
export async function notificationFeed(uid: number, opts: { list: boolean; after: number; lang?: Lang }) {
  const t = makeT(opts.lang ?? "en");
  const unread = (await sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${uid} AND read_at IS NULL`)[0].n as number;
  const rows =
    opts.list || !Number.isFinite(opts.after)
      ? await sql`SELECT * FROM notifications WHERE user_id = ${uid} ORDER BY id DESC LIMIT 15`
      : await sql`SELECT * FROM notifications WHERE user_id = ${uid} AND id > ${opts.after} ORDER BY id ASC LIMIT 20`;
  const latest = await sql`SELECT COALESCE(max(id), 0) AS id FROM notifications WHERE user_id = ${uid}`;
  return { items: (rows as Row[]).map((r) => shape(r, t)), unread, latestId: Number(latest[0].id) };
}
