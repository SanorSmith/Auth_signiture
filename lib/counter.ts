import { sql } from "./db";
import { adjustRule, fits, leadOf, learnRule, normalizeCode, type Rule } from "./counter-match";

// The colli counter: a person counts the packages of one shipment by scanning each package ID.
// The IDs are kept only while the count is open (a "draft"). When it is finished, only the number of
// colli is saved, and the IDs are deleted. A draft nobody finishes is dropped after 24 hours.

export type CounterState = {
  active: boolean;
  count: number;
  reference: string | null; // the first package scanned; the rule compares against it
  rule: Rule | null;
  expected: number | null;
  source: "memory" | "scans" | "adjusted" | null; // where the rule came from
  noteCompare: boolean; // may the person compare with a delivery note photo? (an administrator can turn it off)
  recent: { code: string; forced: boolean; at: number }[]; // newest first
};

export type ScanOutcome = "counted" | "duplicate" | "mismatch" | "invalid";

const RECENT = 8;

async function prune() {
  await sql`DELETE FROM counter_drafts WHERE updated_at < now() - interval '24 hours'`;
}

export async function counterState(uid: number): Promise<CounterState> {
  await prune();
  const noteCompare = await noteCompareEnabled();
  const draft = (await sql`SELECT id, rule_len, rule_prefix, rule_source, expected FROM counter_drafts WHERE user_id = ${uid}`)[0];
  if (!draft) return { active: false, count: 0, reference: null, rule: null, expected: null, source: null, noteCompare, recent: [] };
  const count = (await sql`SELECT count(*)::int AS n FROM counter_scans WHERE draft_id = ${draft.id}`)[0].n as number;
  const reference = (await sql`SELECT code FROM counter_scans WHERE draft_id = ${draft.id} ORDER BY id LIMIT 1`)[0]?.code as string | undefined;
  const recent = await sql`SELECT code, forced, created_at FROM counter_scans WHERE draft_id = ${draft.id} ORDER BY id DESC LIMIT ${RECENT}`;
  return {
    active: true,
    count,
    reference: reference ?? null,
    rule: draft.rule_len ? { len: draft.rule_len as number, prefix: draft.rule_prefix as number } : null,
    expected: (draft.expected as number | null) ?? null,
    source: draft.rule_len ? ((draft.rule_source as CounterState["source"]) ?? "scans") : null,
    noteCompare,
    recent: recent.map((r) => ({ code: r.code as string, forced: r.forced as boolean, at: new Date(r.created_at as string).getTime() })),
  };
}

async function draftFor(uid: number) {
  const rows = await sql`
    INSERT INTO counter_drafts (user_id) VALUES (${uid})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING id, rule_len, rule_prefix`;
  return rows[0] as { id: number; rule_len: number | null; rule_prefix: number | null };
}

// One scanned package. A package that does not fit the shipment is not stored: the person decides
// what to do with it (see counterResolve).
export async function counterScan(uid: number, raw: unknown): Promise<{ outcome: ScanOutcome; code: string | null; state: CounterState }> {
  const code = normalizeCode(raw);
  if (!code) return { outcome: "invalid", code: null, state: await counterState(uid) };
  await prune();
  const draft = await draftFor(uid);
  const first = (await sql`SELECT code FROM counter_scans WHERE draft_id = ${draft.id} ORDER BY id LIMIT 1`)[0]?.code as string | undefined;

  if (!first) {
    await sql`INSERT INTO counter_scans (draft_id, code) VALUES (${draft.id}, ${code}) ON CONFLICT DO NOTHING`;
    return { outcome: "counted", code, state: await counterState(uid) };
  }
  const seen = await sql`SELECT 1 FROM counter_scans WHERE draft_id = ${draft.id} AND code = ${code}`;
  if (seen.length) return { outcome: "duplicate", code, state: await counterState(uid) };

  const known: Rule | null = draft.rule_len ? { len: draft.rule_len, prefix: draft.rule_prefix as number } : null;
  // With no rule yet, codes of this kind seen in earlier counts decide; otherwise the two scans teach it.
  const remembered = known ? null : await rememberedRule(first);
  const rule = known ?? remembered ?? learnRule(first, code);
  if (!rule || !fits(rule, first, code)) return { outcome: "mismatch", code, state: await counterState(uid) };
  if (!known) {
    await sql`UPDATE counter_drafts SET rule_len = ${rule.len}, rule_prefix = ${rule.prefix}, rule_source = ${remembered ? "memory" : "scans"} WHERE id = ${draft.id}`;
  }
  await sql`INSERT INTO counter_scans (draft_id, code) VALUES (${draft.id}, ${code}) ON CONFLICT DO NOTHING`;
  return { outcome: "counted", code, state: await counterState(uid) };
}

export type Finished = { colli: number; expected: number | null };

// Saves the number of colli and forgets the package IDs.
export async function counterFinish(uid: number, email: string, expectedOverride?: number | null): Promise<{ error: string } | ({ ok: true } & Finished)> {
  const draft = (await sql`SELECT id, expected, rule_len, rule_prefix, adjusted FROM counter_drafts WHERE user_id = ${uid}`)[0];
  if (!draft) return { error: "Nothing has been counted yet" };
  const colli = (await sql`SELECT count(*)::int AS n FROM counter_scans WHERE draft_id = ${draft.id}`)[0].n as number;
  if (colli === 0) return { error: "Nothing has been counted yet" };
  // A finished count of at least three packages teaches the rule shape for next time; one the person
  // had to adjust by hand counts three times as much.
  if (draft.rule_len && colli >= 3) {
    const first = (await sql`SELECT code FROM counter_scans WHERE draft_id = ${draft.id} ORDER BY id LIMIT 1`)[0]?.code as string | undefined;
    if (first) await rememberRule(first, { len: draft.rule_len as number, prefix: draft.rule_prefix as number }, draft.adjusted ? 3 : 1);
  }
  const expected = expectedOverride === undefined ? ((draft.expected as number | null) ?? null) : expectedOverride;
  await sql`INSERT INTO counter_results (user_id, user_email, colli, expected) VALUES (${uid}, ${email}, ${colli}, ${expected})`;
  await sql`DELETE FROM counter_drafts WHERE id = ${draft.id}`;
  return { ok: true, colli, expected };
}

// What to do with a package that does not fit: leave it out, count it anyway, or finish this
// shipment and start the next one with it.
export async function counterResolve(
  uid: number,
  email: string,
  raw: unknown,
  choice: "ignore" | "count" | "new",
): Promise<{ error: string } | { ok: true; finished: Finished | null; state: CounterState }> {
  const code = normalizeCode(raw);
  if (!code) return { error: "Not a valid package code" };
  if (choice === "ignore") return { ok: true, finished: null, state: await counterState(uid) };

  let finished: Finished | null = null;
  if (choice === "new") {
    const done = await counterFinish(uid, email);
    if ("ok" in done) finished = { colli: done.colli, expected: done.expected };
  }
  const draft = await draftFor(uid);
  await sql`INSERT INTO counter_scans (draft_id, code, forced) VALUES (${draft.id}, ${code}, ${choice === "count"}) ON CONFLICT DO NOTHING`;
  return { ok: true, finished, state: await counterState(uid) };
}

export async function counterAdjust(uid: number, delta: number): Promise<CounterState> {
  const draft = (await sql`SELECT id, rule_len, rule_prefix FROM counter_drafts WHERE user_id = ${uid}`)[0];
  if (draft?.rule_len) {
    const next = adjustRule({ len: draft.rule_len as number, prefix: draft.rule_prefix as number }, Math.trunc(delta));
    await sql`UPDATE counter_drafts SET rule_prefix = ${next.prefix}, rule_source = 'adjusted', adjusted = true, updated_at = now() WHERE id = ${draft.id}`;
  }
  return counterState(uid);
}

export async function counterSetExpected(uid: number, expected: number | null): Promise<CounterState> {
  const value = expected !== null && Number.isInteger(expected) && expected >= 1 && expected <= 9999 ? expected : null;
  const rows = await sql`UPDATE counter_drafts SET expected = ${value}, updated_at = now() WHERE user_id = ${uid} RETURNING id`;
  if (!rows.length && value !== null) await sql`INSERT INTO counter_drafts (user_id, expected) VALUES (${uid}, ${value}) ON CONFLICT (user_id) DO UPDATE SET expected = ${value}`;
  return counterState(uid);
}

// Takes back the newest scan. With fewer than two left the rule is forgotten, so it is learned again.
export async function counterUndo(uid: number): Promise<CounterState> {
  const draft = (await sql`SELECT id FROM counter_drafts WHERE user_id = ${uid}`)[0];
  if (draft) {
    await sql`DELETE FROM counter_scans WHERE id = (SELECT id FROM counter_scans WHERE draft_id = ${draft.id} ORDER BY id DESC LIMIT 1)`;
    const left = (await sql`SELECT count(*)::int AS n FROM counter_scans WHERE draft_id = ${draft.id}`)[0].n as number;
    if (left < 2) await sql`UPDATE counter_drafts SET rule_len = NULL, rule_prefix = NULL, rule_source = NULL, adjusted = false WHERE id = ${draft.id}`;
  }
  return counterState(uid);
}

export async function counterCancel(uid: number): Promise<CounterState> {
  await sql`DELETE FROM counter_drafts WHERE user_id = ${uid}`;
  return counterState(uid);
}

// --- Delivery note comparison -----------------------------------------------------------------------
// An administrator can switch it off. The setting is a row in app_settings; on unless it says "off".

export async function noteCompareEnabled(): Promise<boolean> {
  const rows = await sql`SELECT value FROM app_settings WHERE key = 'note_compare'`;
  return rows[0]?.value !== "off";
}

export async function setNoteCompareEnabled(on: boolean) {
  await sql`
    INSERT INTO app_settings (key, value) VALUES ('note_compare', ${on ? "on" : "off"})
    ON CONFLICT (key) DO UPDATE SET value = ${on ? "on" : "off"}`;
}

// The packages scanned so far in this person's open count, for the comparison.
export async function scannedCodes(uid: number): Promise<string[]> {
  const rows = await sql`
    SELECT s.code FROM counter_scans s JOIN counter_drafts d ON d.id = s.draft_id
    WHERE d.user_id = ${uid} ORDER BY s.id`;
  return rows.map((r) => r.code as string);
}

// --- Rule memory --------------------------------------------------------------------------------
// What earlier counts showed about codes that start the same way and have the same length.

const MAX_RULES = 500;

async function rememberedRule(first: string): Promise<Rule | null> {
  const rows = await sql`
    SELECT len, prefix FROM counter_rules WHERE len = ${first.length} AND lead = ${leadOf(first)}
    ORDER BY uses DESC, last_used DESC LIMIT 1`;
  return rows[0] ? { len: rows[0].len as number, prefix: rows[0].prefix as number } : null;
}

async function rememberRule(first: string, rule: Rule, weight: number) {
  await sql`
    INSERT INTO counter_rules (len, lead, prefix, uses) VALUES (${rule.len}, ${leadOf(first)}, ${rule.prefix}, ${weight})
    ON CONFLICT (len, lead, prefix) DO UPDATE SET uses = counter_rules.uses + ${weight}, last_used = now()`;
  await sql`
    DELETE FROM counter_rules WHERE id NOT IN (SELECT id FROM counter_rules ORDER BY uses DESC, last_used DESC LIMIT ${MAX_RULES})`;
}

export type RememberedRule = { id: number; lead: string; len: number; prefix: number; uses: number; lastUsed: number };

export async function listRememberedRules(): Promise<RememberedRule[]> {
  const rows = await sql`SELECT id, lead, len, prefix, uses, last_used FROM counter_rules ORDER BY uses DESC, last_used DESC`;
  return rows.map((r) => ({
    id: r.id as number,
    lead: r.lead as string,
    len: r.len as number,
    prefix: r.prefix as number,
    uses: r.uses as number,
    lastUsed: new Date(r.last_used as string).getTime(),
  }));
}

export async function forgetRule(id: number) {
  await sql`DELETE FROM counter_rules WHERE id = ${id}`;
}

export async function forgetAllRules() {
  await sql`DELETE FROM counter_rules`;
}

// --- Statistics ---------------------------------------------------------------------------------

export type Unit = "day" | "week" | "month";
export type Bucket = { start: string; shipments: number; colli: number };
export type Stats = {
  unit: Unit;
  from: string;
  to: string;
  buckets: Bucket[];
  shipments: number;
  colli: number;
  average: number; // colli per shipment
  mismatched: number; // shipments where the counted number differs from the expected one
  withExpected: number;
};

const DAY = 86_400_000;
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

// Today in Stockholm, as YYYY-MM-DD.
export const todayStockholm = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

export const addDays = (date: string, n: number) => fmt(new Date(toDate(date).getTime() + n * DAY));

// First day of the day / week (Monday) / month that a date falls in.
function bucketStart(date: string, unit: Unit): string {
  const d = toDate(date);
  if (unit === "day") return date;
  if (unit === "month") return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const back = (d.getUTCDay() + 6) % 7;
  return fmt(new Date(d.getTime() - back * DAY));
}

function nextBucket(start: string, unit: Unit): string {
  if (unit === "day") return addDays(start, 1);
  if (unit === "week") return addDays(start, 7);
  const d = toDate(start);
  return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

export function parseRange(input: { unit?: unknown; from?: unknown; to?: unknown }): { unit: Unit; from: string; to: string } {
  const unit: Unit = input.unit === "week" || input.unit === "month" ? input.unit : "day";
  const today = todayStockholm();
  let to = isDate(input.to) ? input.to : today;
  let from = isDate(input.from) ? input.from : addDays(to, unit === "day" ? -13 : unit === "week" ? -83 : -364);
  if (from > to) [from, to] = [to, from];
  if ((toDate(to).getTime() - toDate(from).getTime()) / DAY > 800) from = addDays(to, -800);
  return { unit, from, to };
}

// Shipments and colli per day, week or month between two dates (Stockholm time), for everyone or only one person.
export async function counterStats(range: { unit: Unit; from: string; to: string }, onlyUid: number | null): Promise<Stats> {
  const { unit, from, to } = range;
  const rows = await sql`
    SELECT to_char(date_trunc(${unit}, finished_at AT TIME ZONE 'Europe/Stockholm'), 'YYYY-MM-DD') AS start,
           count(*)::int AS shipments, sum(colli)::int AS colli,
           count(*) FILTER (WHERE expected IS NOT NULL)::int AS with_expected,
           count(*) FILTER (WHERE expected IS NOT NULL AND expected <> colli)::int AS mismatched
    FROM counter_results
    WHERE (finished_at AT TIME ZONE 'Europe/Stockholm') >= ${from}::date
      AND (finished_at AT TIME ZONE 'Europe/Stockholm') < (${to}::date + 1)
      AND (${onlyUid}::int IS NULL OR user_id = ${onlyUid}::int)
    GROUP BY 1 ORDER BY 1`;
  const found = new Map(rows.map((r) => [r.start as string, r]));
  const buckets: Bucket[] = [];
  for (let s = bucketStart(from, unit); s <= to; s = nextBucket(s, unit)) {
    const r = found.get(s);
    buckets.push({ start: s, shipments: (r?.shipments as number) ?? 0, colli: (r?.colli as number) ?? 0 });
  }
  const shipments = rows.reduce((n, r) => n + (r.shipments as number), 0);
  const colli = rows.reduce((n, r) => n + (r.colli as number), 0);
  return {
    unit,
    from,
    to,
    buckets,
    shipments,
    colli,
    average: shipments ? Math.round((colli / shipments) * 10) / 10 : 0,
    mismatched: rows.reduce((n, r) => n + (r.mismatched as number), 0),
    withExpected: rows.reduce((n, r) => n + (r.with_expected as number), 0),
  };
}

// The period right before this one, of the same length: the default to compare against.
export function previousRange(range: { unit: Unit; from: string; to: string }) {
  const days = Math.round((toDate(range.to).getTime() - toDate(range.from).getTime()) / DAY) + 1;
  return { unit: range.unit, from: addDays(range.from, -days), to: addDays(range.from, -1) };
}
