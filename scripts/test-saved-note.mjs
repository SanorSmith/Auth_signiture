// End-to-end test of the saved delivery note table API against a running server.
//   BASE_URL=http://localhost:3222 node --env-file=.env.local scripts/test-saved-note.mjs
// It creates throwaway users and removes them at the end.
import { neon } from "@neondatabase/serverless";

const BASE = process.env.BASE_URL ?? "http://localhost:3222";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const PW = "Qa-Pass-" + stamp + "-Aa1";
let fails = 0;
const check = (n, ok, x) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + JSON.stringify(x)}`); if (!ok) fails++; };

async function call(method, path, token, body) {
  const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
const login = async (email) => (await call("POST", "/api/mobile/login", null, { email, password: PW })).body?.token;

const one = { email: `qa-sv-one-${stamp}@example.com` };
const two = { email: `qa-sv-two-${stamp}@example.com` };
const plain = { email: `qa-sv-plain-${stamp}@example.com` };
try {
  const { execFileSync } = await import("node:child_process");
  for (const u of [one, two, plain]) execFileSync("node", ["--env-file=.env.local", "scripts/create-user.mjs", u.email, PW, "client"], { stdio: "pipe" });
  await sql`UPDATE users SET permissions = ARRAY['request','note_table'] WHERE email IN (${one.email}, ${two.email})`;
  const t1 = await login(one.email), t2 = await login(two.email), tp = await login(plain.email);
  check("the throwaway users can sign in", !!t1 && !!t2 && !!tp);

  check("no login: refused", (await call("GET", "/api/mobile/notes/saved", null)).status === 401);
  check("without the permission: refused", (await call("GET", "/api/mobile/notes/saved", tp)).status === 403);
  check("without the permission: cannot save", (await call("POST", "/api/mobile/notes/saved", tp, { rows: [{ item: "A", delivered: "1", description: "" }] })).status === 403);

  let r = await call("GET", "/api/mobile/notes/saved", t1);
  check("starts empty", r.status === 200 && r.body.rows.length === 0, r);

  const page1 = [{ item: "AB-100", delivered: "8", description: "Bult M8" }, { item: "CD-2001", delivered: "100", description: "Mutter" }];
  r = await call("POST", "/api/mobile/notes/saved", t1, { rows: page1 });
  check("saves a table", r.status === 200 && r.body.rows.length === 2, r);
  r = await call("GET", "/api/mobile/notes/saved", t1);
  check("reads it back in order", JSON.stringify(r.body.rows) === JSON.stringify(page1), r.body);

  const both = [...page1, { item: "EF-300", delivered: "3", description: "Bricka åäö" }];
  await call("POST", "/api/mobile/notes/saved", t1, { rows: both });
  r = await call("GET", "/api/mobile/notes/saved", t1);
  check("a page added after the others keeps the order and the letters", r.body.rows.length === 3 && r.body.rows[2].description === "Bricka åäö" && r.body.rows[0].item === "AB-100", r.body);

  await call("POST", "/api/mobile/notes/saved", t1, { rows: [both[0], both[2]] });
  r = await call("GET", "/api/mobile/notes/saved", t1);
  check("removing a line removes only that line", r.body.rows.length === 2 && r.body.rows[1].item === "EF-300", r.body);

  r = await call("GET", "/api/mobile/notes/saved", t2);
  check("another person sees nothing of it", r.body.rows.length === 0, r.body);

  r = await call("POST", "/api/mobile/notes/saved", t1, { rows: [{ item: "x".repeat(300), delivered: "9".repeat(50), description: "y\n\nz".repeat(100) }, { item: "", delivered: "", description: "" }] });
  check("long text is cut and an empty line is dropped", r.status === 200 && r.body.rows.length === 1 && r.body.rows[0].item.length === 40 && r.body.rows[0].delivered.length === 20 && r.body.rows[0].description.length <= 120 && !r.body.rows[0].description.includes("\n"), r.body);

  check("not a list is refused", (await call("POST", "/api/mobile/notes/saved", t1, { rows: "no" })).status === 400);
  check("too many lines are refused", (await call("POST", "/api/mobile/notes/saved", t1, { rows: Array.from({ length: 2001 }, () => ({ item: "A", delivered: "1", description: "" })) })).status === 400);
  r = await call("GET", "/api/mobile/notes/saved", t1);
  check("a refused save changes nothing", r.body.rows.length === 1, r.body);

  r = await call("POST", "/api/mobile/notes/saved", t1, { rows: [] });
  check("sending no lines clears the table", r.status === 200 && r.body.rows.length === 0, r);
  r = await call("GET", "/api/mobile/notes/saved", t1);
  check("and it stays cleared", r.body.rows.length === 0, r.body);
} finally {
  for (const u of [one, two, plain]) await sql`DELETE FROM users WHERE email = ${u.email}`.catch(() => {});
  const left = await sql`SELECT count(*)::int AS n FROM saved_note_rows WHERE user_id NOT IN (SELECT id FROM users)`;
  console.log(`orphaned saved lines after cleanup: ${left[0].n}`);
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
