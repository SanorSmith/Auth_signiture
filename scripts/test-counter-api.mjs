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

// A person who may count but is not an administrator.
const plain = { email: `qa-plain-${stamp}@example.com`, password: `Pl-${stamp}-Aa1!x` };
const made = await call("POST", "/api/mobile/users/create", ta, { email: plain.email, password: plain.password, perms: ["colli_counter"] });
check("a non-administrator with the counter permission is created", made.status === 200, made);
let tp = await login(plain);
const changedPw = await call("POST", "/api/mobile/password", tp, { current: plain.password, next: `${plain.password}-new`, confirm: `${plain.password}-new` });
tp = changedPw.body?.token;
check("they can count", (await call("GET", `${C}/state`, tp)).status === 200);
check("but the statistics are refused for them", (await call("GET", `${C}/stats?unit=day`, tp)).status === 403);
check("and the delivery note setting too", (await call("POST", `${C}/note-setting`, tp, { on: false })).status === 403);
const page = (token, path) => fetch(BASE + path, { headers: { authorization: `Bearer ${token}` }, redirect: "manual" }).then((r) => r.status);
check("the statistics page sends a non-administrator away", [307, 308].includes(await page(tp, "/counter/dashboard")), await page(tp, "/counter/dashboard"));
check("and the settings page too", [307, 308].includes(await page(tp, "/counter/rules")));
check("an administrator opens the statistics page", (await page(ta, "/counter/dashboard")) === 200);
check("an administrator still gets the statistics", (await call("GET", `${C}/stats?unit=day`, ta)).status === 200);

// The delivery note comparison can be switched off by an administrator (a real setting in the database).
// The tests never change it for good: what needs it on is skipped when it is off, and the one test that
// switches it restores exactly what was there.
const noteOn = (await call("GET", `${C}/state`, ta)).body.noteCompare === true;
const settingBefore = sql ? (await sql`SELECT value FROM app_settings WHERE key = 'note_compare'`)[0]?.value : undefined;
if (!noteOn) console.log("SKIP  the delivery note comparison is switched off here: its checks are skipped");

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

if (noteOn) {
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
    // Put back exactly what was there before.
    if (settingBefore === undefined) await sql`DELETE FROM app_settings WHERE key = 'note_compare'`;
    else await sql`INSERT INTO app_settings (key, value) VALUES ('note_compare', ${settingBefore}) ON CONFLICT (key) DO UPDATE SET value = ${settingBefore}`;
  }
  check("and back to what it was", (await call("GET", `${C}/state`, ta)).body.noteCompare === true);
}
await call("POST", `${C}/finish`, ta);
if (sql) {
  const left = await sql`SELECT count(*)::int AS n FROM counter_scans s JOIN counter_drafts d ON d.id = s.draft_id WHERE s.code LIKE 'ZQN%'`;
  check("no package ID of the note comparison is left after finishing", left[0].n === 0, left);
}

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
  await sql`DELETE FROM counter_rules WHERE lead IN ('ZQS', 'ZQX', 'ZQN', 'ZQM')`;
}

// --- several deliveries in one count ---------------------------------------------------------------
const sa = `11${stamp.slice(0, 4)}`;
const sb = `22${stamp.slice(0, 4)}`;
const sc = `33${stamp.slice(0, 4)}`;
const mk = (s6, n) => `ZQM${s6}0${String(n).padStart(4, "0")}`;
await call("POST", `${C}/cancel`, ta);
let m = (await call("POST", `${C}/mode`, ta, { multi: true })).body;
check("a count of several deliveries starts empty", m.multi === true && m.groups.length === 0 && m.active === true, m);
r = (await call("POST", `${C}/scan`, ta, { code: mk(sa, 1) })).body;
check("the first package starts delivery 1", r.outcome === "new_delivery" && r.state.groups.length === 1, r);
r = (await call("POST", `${C}/scan`, ta, { code: mk(sb, 1) })).body;
check("a package of another delivery starts delivery 2 without asking", r.outcome === "new_delivery" && r.state.groups.length === 2, r.state.groups);
r = (await call("POST", `${C}/scan`, ta, { code: mk(sa, 2) })).body;
check("the next package of delivery 1 joins it, though delivery 2 was started in between", r.outcome === "counted" && r.state.groups[0].count === 2 && r.state.groups[1].count === 1 && r.state.groups[0].rule !== null, r.state.groups);
r = (await call("POST", `${C}/scan`, ta, { code: mk(sb, 2) })).body;
check("and the same for delivery 2", r.outcome === "counted" && r.state.groups[1].count === 2, r.state.groups);
await call("POST", `${C}/scan`, ta, { code: mk(sa, 3) });
await call("POST", `${C}/scan`, ta, { code: mk(sb, 3) });
r = (await call("POST", `${C}/scan`, ta, { code: mk(sa, 2) })).body;
check("a package scanned twice is a duplicate, whichever delivery holds it", r.outcome === "duplicate", r);
s = (await call("GET", `${C}/state`, ta)).body;
check("the total and each delivery are counted", s.count === 6 && s.groups.map((x) => x.count).join() === "3,3", s.groups);

const g1 = s.groups[0];
s = (await call("POST", `${C}/group-adjust`, ta, { group: g1.id, delta: -1 })).body;
check("one delivery's rule can be narrowed on its own", s.groups[0].rule.prefix === g1.rule.prefix - 1 && s.groups[0].source === "adjusted" && s.groups[1].source !== "adjusted", s.groups);
await call("POST", `${C}/group-adjust`, ta, { group: g1.id, delta: 1 });
s = (await call("POST", `${C}/group-expected`, ta, { group: g1.id, expected: 4 })).body;
check("an expected number is kept per delivery", s.groups[0].expected === 4 && s.groups[1].expected === null, s.groups);
check("a delivery in someone else's count cannot be changed", (await call("POST", `${C}/group-expected`, tb, { group: g1.id, expected: 9 })).body.groups?.length === 0);

if (noteOn) {
let nc = (await call("POST", `${C}/note-compare`, ta, { ids: [mk(sa, 1), mk(sa, 2), mk(sa, 3), mk(sa, 4)], group: g1.id })).body;
check("a note for delivery 1 is compared with delivery 1 only (delivery 2's packages are not extra)", nc.missing.join() === mk(sa, 4) && nc.extra.length === 0 && nc.matched.length === 3, nc);
nc = (await call("POST", `${C}/note-compare`, ta, { ids: [mk(sa, 1), mk(sa, 2), mk(sa, 3), mk(sa, 4), mk(sb, 1), mk(sb, 2), mk(sb, 3), mk(sc, 1), mk(sc, 2)], group: "all" })).body;
check("a note that lists everything is split by delivery", nc.deliveries?.length === 2 && nc.deliveries[0].comparison.missing.join() === mk(sa, 4) && nc.deliveries[1].comparison.missing.length === 0, nc);
check("and a delivery on the note that was never scanned is reported", nc.unscanned?.length === 1 && nc.unscanned[0].length === 2, nc.unscanned);

}

s = (await call("POST", `${C}/undo`, ta)).body;
check("remove last takes back the newest package of any delivery", s.count === 5 && s.groups[1].count === 2, s.groups);
await call("POST", `${C}/scan`, ta, { code: mk(sc, 1) });
s = (await call("GET", `${C}/state`, ta)).body;
check("a third delivery is started", s.groups.length === 3, s.groups.length);
s = (await call("POST", `${C}/undo`, ta)).body;
check("taking back its only package removes the delivery", s.groups.length === 2, s.groups.length);
check("going back to one delivery needs the deliveries merged first", (await call("POST", `${C}/mode`, ta, { multi: false })).status === 400);

const [d1, d2] = s.groups;
s = (await call("POST", `${C}/group-merge`, ta, { from: d2.id, into: d1.id })).body;
check("two deliveries can be joined", s.groups.length === 1 && s.groups[0].count === 5 && s.groups[0].expected === 4, s.groups);
s = (await call("POST", `${C}/mode`, ta, { multi: false })).body;
check("with one delivery left the count goes back to a single delivery, keeping what was counted", s.multi === false && s.count === 5 && s.groups.length === 0, s);
await call("POST", `${C}/cancel`, ta);

// A single count that meets a package of another delivery can turn into several.
await call("POST", `${C}/scan`, ta, { code: mk(sa, 1) });
await call("POST", `${C}/scan`, ta, { code: mk(sa, 2) });
r = (await call("POST", `${C}/scan`, ta, { code: mk(sb, 1) })).body;
check("in a single count another delivery's package is a mismatch", r.outcome === "mismatch", r);
r = (await call("POST", `${C}/resolve`, ta, { code: mk(sb, 1), choice: "delivery" })).body;
check("it can be counted as another delivery, which turns the count into several", r.state.multi === true && r.state.groups.length === 2 && r.state.groups[0].count === 2 && r.state.groups[1].count === 1, r.state);
await call("POST", `${C}/scan`, ta, { code: mk(sb, 2) });
await call("POST", `${C}/scan`, ta, { code: mk(sb, 3) });
const before = (await call("GET", `${C}/stats?unit=day&compare=0`, ta)).body.current;
const fin = (await call("POST", `${C}/finish`, ta)).body;
check("finishing saves every delivery", fin.ok === true && fin.deliveries?.length === 2 && fin.deliveries.map((x) => x.colli).join() === "2,3" && fin.colli === 5, fin);
const after2 = (await call("GET", `${C}/stats?unit=day&compare=0`, ta)).body.current;
check("each delivery is a shipment of its own in the statistics", after2.shipments - before.shipments === 2 && after2.colli - before.colli === 5, { before: before.shipments, after: after2.shipments });
check("the count is closed afterwards", (await call("GET", `${C}/state`, ta)).body.active === false);
if (sql) {
  const left = await sql`SELECT (SELECT count(*) FROM counter_scans s JOIN counter_drafts d ON d.id = s.draft_id JOIN users u ON u.id = d.user_id WHERE u.email = ${A.email})::int AS scans, (SELECT count(*) FROM counter_groups g JOIN counter_drafts d ON d.id = g.draft_id JOIN users u ON u.id = d.user_id WHERE u.email = ${A.email})::int AS groups`;
  check("no package and no delivery is left behind", left[0].scans === 0 && left[0].groups === 0, left);
}

const sv = await call("POST", `${C}/finish`, ta, null, "sv");
check("messages come back in Swedish", sv.body?.error === "Inget har räknats ännu", sv.body);

if (sql) {
  await sql`DELETE FROM users WHERE email = ${plain.email}`;
  await sql`DELETE FROM counter_results WHERE user_email IN (${A.email}, ${B.email}, ${plain.email})`;
  console.log("cleaned up the saved test results");
}
if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
