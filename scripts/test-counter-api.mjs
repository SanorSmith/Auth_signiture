// End-to-end test of the colli counter against a running server.
//   BASE_URL=http://localhost:3222 ADMIN_EMAIL=... ADMIN_PASSWORD=... OTHER_EMAIL=... OTHER_PASSWORD=... \
//   MONITOR_EMAIL=... MONITOR_PASSWORD=... node --env-file=.env.local scripts/test-counter-api.mjs
// ADMIN and OTHER need the colli counter permission (administrators have it); MONITOR must not.
// With DATABASE_URL set it also checks that no package code is left behind and removes the saved
// results it made (they carry the test user's email).
import { neon } from "@neondatabase/serverless";

const BASE = process.env.BASE_URL ?? "http://localhost:3222";
const need = (k) => process.env[k] ?? (console.error(`Set ${k}`), process.exit(2));
const A = { email: need("ADMIN_EMAIL"), password: need("ADMIN_PASSWORD") };
const B = { email: need("OTHER_EMAIL"), password: need("OTHER_PASSWORD") };
const M = { email: need("MONITOR_EMAIL"), password: need("MONITOR_PASSWORD") };
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

let failures = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

async function call(method, path, token, body, lang) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(lang ? { "accept-language": lang } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, body: json };
}
const login = async (u) => (await call("POST", "/api/mobile/login", null, u)).body?.token;
const C = "/api/mobile/counter";

const ta = await login(A);
const tb = await login(B);
const tm = await login(M);
check("signed in", !!ta && !!tb && !!tm);

// Two shipments of an 18-digit carrier ID: same start, different last digits.
const stamp = String(Date.now()).slice(-6);
const base = `ZQS${stamp}12345`; // test codes all start with ZQ, so the rules they teach can be removed safely
const ship = (n) => `${base}${String(n).padStart(4, "0")}`;
const other = `ZQX${stamp}999990017`;

check("a user without the permission is refused", (await call("GET", `${C}/state`, tm)).status === 403);
check("no token is refused", (await call("GET", `${C}/state`, null)).status === 401);

const statsBefore = (await call("GET", `${C}/stats?unit=day&compare=0`, ta)).body.current;
const mineBefore = (await call("GET", `${C}/stats?unit=day&compare=0&mine=1`, tb)).body.current;

let s = (await call("GET", `${C}/state`, ta)).body;
check("starts with nothing open", s.active === false && s.count === 0, s);

check("a code that is too short is invalid", (await call("POST", `${C}/scan`, ta, { code: "ab" })).body.outcome === "invalid");

let r = (await call("POST", `${C}/scan`, ta, { code: ship(10) })).body;
check("the first package is counted", r.outcome === "counted" && r.state.count === 1 && r.state.rule === null, r);
r = (await call("POST", `${C}/scan`, ta, { code: ship(11) })).body;
check("the second is counted and the rule is learned", r.outcome === "counted" && r.state.count === 2 && r.state.rule?.len === ship(1).length && r.state.rule?.prefix === ship(1).length - 3, r);
r = (await call("POST", `${C}/scan`, ta, { code: ship(11) })).body;
check("the same package twice is a duplicate, not counted", r.outcome === "duplicate" && r.state.count === 2, r);
r = (await call("POST", `${C}/scan`, ta, { code: ship(12).toLowerCase() })).body;
check("lower case and the third package are counted", r.outcome === "counted" && r.state.count === 3, r);
r = (await call("POST", `${C}/scan`, ta, { code: other })).body;
check("a package from another shipment is a mismatch and is not stored", r.outcome === "mismatch" && r.state.count === 3, r);
r = (await call("POST", `${C}/resolve`, ta, { code: other, choice: "ignore" })).body;
check("ignoring it leaves the count alone", r.state.count === 3, r);
r = (await call("POST", `${C}/resolve`, ta, { code: other, choice: "count" })).body;
check("counting it anyway adds it, marked as forced", r.state.count === 4 && r.state.recent[0].forced === true, r);

s = (await call("POST", `${C}/adjust`, ta, { delta: -2 })).body;
check("the rule can be narrowed", s.rule.prefix === ship(1).length - 5, s.rule);
s = (await call("POST", `${C}/adjust`, ta, { delta: 99 })).body;
check("and widened, but never to the whole code", s.rule.prefix === ship(1).length - 1, s.rule);
await call("POST", `${C}/adjust`, ta, { delta: -99 });
s = (await call("POST", `${C}/adjust`, ta, { delta: 99 })).body;

s = (await call("POST", `${C}/undo`, ta)).body;
check("remove last takes back the newest package", s.count === 3, s);
s = (await call("POST", `${C}/expected`, ta, { expected: 3 })).body;
check("the expected number is kept", s.expected === 3, s);

check("another user has their own, empty count", (await call("GET", `${C}/state`, tb)).body.active === false);

const done = (await call("POST", `${C}/finish`, ta)).body;
check("finishing returns the colli received", done.ok === true && done.colli === 3 && done.expected === 3, done);
s = (await call("GET", `${C}/state`, ta)).body;
check("the count is closed afterwards", s.active === false && s.count === 0, s);
check("finishing again with nothing open is refused", (await call("POST", `${C}/finish`, ta)).status === 400);
if (sql) {
  const left = await sql`SELECT count(*)::int AS n FROM counter_scans s JOIN counter_drafts d ON d.id = s.draft_id JOIN users u ON u.id = d.user_id WHERE u.email = ${A.email}`;
  check("no package code is left in the database", left[0].n === 0, left);
}

// A second shipment, started from a package that did not fit the first.
await call("POST", `${C}/scan`, ta, { code: ship(1) });
await call("POST", `${C}/scan`, ta, { code: ship(2) });
r = (await call("POST", `${C}/scan`, ta, { code: other })).body;
check("a wrong package is a mismatch", r.outcome === "mismatch", r);
r = (await call("POST", `${C}/resolve`, ta, { code: other, choice: "new" })).body;
check("save and start a new shipment closes the old one", r.finished?.colli === 2 && r.state.count === 1 && r.state.reference === other, r);
s = (await call("POST", `${C}/cancel`, ta)).body;
check("cancel throws the open count away", s.active === false, s);

const after = (await call("GET", `${C}/stats?unit=day&compare=0`, ta)).body.current;
check("the statistics count the two saved shipments", after.shipments - statsBefore.shipments === 2 && after.colli - statsBefore.colli === 5, { before: statsBefore, after });
const mineAfter = (await call("GET", `${C}/stats?unit=day&compare=0&mine=1`, tb)).body.current;
check("'only me' does not include another person's shipments", mineAfter.shipments === mineBefore.shipments, { mineBefore, mineAfter });
const withCompare = (await call("GET", `${C}/stats?unit=week&from=2026-01-01&to=2026-03-31`, ta)).body;
check("a period can be compared with the one before it", withCompare.compare && withCompare.compare.to === "2025-12-31" && withCompare.current.buckets.length >= 12, withCompare.compare);

// --- delivery note comparison ------------------------------------------------------------------
const nz = (n) => `ZQN${stamp}000${String(n).padStart(4, "0")}`;
check("comparing with nothing counted is refused", (await call("POST", `${C}/note-compare`, ta, { ids: [nz(1)] })).status === 400);
await call("POST", `${C}/scan`, ta, { code: nz(1) });
await call("POST", `${C}/scan`, ta, { code: nz(2) });
await call("POST", `${C}/scan`, ta, { code: nz(3) });
let cmp = (await call("POST", `${C}/note-compare`, ta, { ids: [nz(1), nz(2).toLowerCase(), nz(3), nz(4)] })).body;
check("a package on the note that was not scanned is missing", cmp.matched.length === 3 && cmp.missing.join() === nz(4) && cmp.extra.length === 0, cmp);
cmp = (await call("POST", `${C}/note-compare`, ta, { ids: [nz(1), nz(2)] })).body;
check("a scanned package not on the note is extra", cmp.extra.join() === nz(3) && cmp.missing.length === 0, cmp);
cmp = (await call("POST", `${C}/note-compare`, ta, { ids: [nz(1), nz(2), nz(3).slice(0, -1) + "9"] })).body;
check("one character off is reported as a possible misread", cmp.possible.length === 1 && cmp.missing.length === 0 && cmp.extra.length === 0, cmp);
cmp = (await call("POST", `${C}/note-compare`, ta, { ids: [nz(1), nz(2), nz(3)] })).body;
check("a complete note matches", cmp.matched.length === 3 && !cmp.missing.length && !cmp.extra.length && !cmp.possible.length, cmp);
check("an empty list is refused", (await call("POST", `${C}/note-compare`, ta, { ids: [] })).status === 400);
const readNoImage = await call("POST", `${C}/note-read`, ta, { image: "x", mediaType: "image/jpeg" });
check("reading needs a real photo (or the AI key is not set)", readNoImage.status === 400 || readNoImage.status === 503, readNoImage);
if (sql) {
  await sql`INSERT INTO app_settings (key, value) VALUES ('note_compare', 'off') ON CONFLICT (key) DO UPDATE SET value = 'off'`;
  try {
    check("the administrator can turn the comparison off", (await call("GET", `${C}/state`, ta)).body.noteCompare === false);
    check("compare is refused while it is off", (await call("POST", `${C}/note-compare`, ta, { ids: [nz(1)] })).status === 403);
    check("reading is refused while it is off", (await call("POST", `${C}/note-read`, ta, { image: "x".repeat(200), mediaType: "image/jpeg" })).status === 403);
  } finally {
    await sql`DELETE FROM app_settings WHERE key = 'note_compare'`;
  }
  check("and on again by default", (await call("GET", `${C}/state`, ta)).body.noteCompare === true);
}
await call("POST", `${C}/finish`, ta);
if (sql) {
  const left = await sql`SELECT count(*)::int AS n FROM counter_scans s JOIN counter_drafts d ON d.id = s.draft_id WHERE s.code LIKE 'ZQN%'`;
  check("no package ID of the note comparison is left after finishing", left[0].n === 0, left);
}

// --- rule memory: a finished count teaches the next one ----------------------------------------
const zq = (n) => `ZQT${stamp}000${String(n).padStart(4, "0")}`;
const zlen = zq(1).length;
if (sql) await sql`DELETE FROM counter_rules WHERE lead = 'ZQT'`;
await call("POST", `${C}/scan`, ta, { code: zq(1) });
r = (await call("POST", `${C}/scan`, ta, { code: zq(2) })).body;
check("without memory the rule is learned from the two scans", r.state.source === "scans" && r.state.rule.prefix === zlen - 3, r.state);
s = (await call("POST", `${C}/adjust`, ta, { delta: 1 })).body;
check("adjusting marks the rule as adjusted", s.source === "adjusted" && s.rule.prefix === zlen - 2, s);
await call("POST", `${C}/scan`, ta, { code: zq(3) });
check("the three packages finish", (await call("POST", `${C}/finish`, ta)).body.colli === 3);
if (sql) {
  const kept = await sql`SELECT len, prefix, uses FROM counter_rules WHERE lead = 'ZQT'`;
  check("only the shape is kept, with extra weight for the adjustment", kept.length === 1 && kept[0].prefix === zlen - 2 && kept[0].uses === 3, kept);
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'counter_rules'`;
  check("the memory table has no column for a whole code", !cols.some((c) => c.column_name === "code"), cols);
}
await call("POST", `${C}/scan`, ta, { code: zq(10) });
r = (await call("POST", `${C}/scan`, ta, { code: zq(11) })).body;
check("the next count of this kind starts from the remembered rule", r.outcome === "counted" && r.state.source === "memory" && r.state.rule.prefix === zlen - 2, r.state);
await call("POST", `${C}/cancel`, ta);
await call("POST", `${C}/scan`, ta, { code: zq(10) });
r = (await call("POST", `${C}/scan`, ta, { code: zq(110) })).body;
check("the remembered rule refuses a package the scans alone would have accepted", r.outcome === "mismatch", r);
await call("POST", `${C}/cancel`, ta);
if (sql) {
  await sql`DELETE FROM counter_rules WHERE lead = 'ZQT'`;
  await sql`DELETE FROM counter_rules WHERE lead IN ('ZQS', 'ZQX', 'ZQN')`;
}

const sv = await call("POST", `${C}/finish`, ta, null, "sv");
check("messages come back in Swedish", sv.body?.error === "Inget har räknats ännu", sv.body);

if (sql) {
  await sql`DELETE FROM counter_results WHERE user_email IN (${A.email}, ${B.email})`;
  console.log("cleaned up the saved test results");
}
if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
