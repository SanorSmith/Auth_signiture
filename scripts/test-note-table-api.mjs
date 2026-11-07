// End-to-end test of the delivery note table API against a running server whose AI is the stand-in
// (scripts/fake-ai.mjs). Needs DATABASE_URL (run with --env-file=.env.local) and BASE_URL.
//   BASE_URL=http://localhost:3222 node --env-file=.env.local scripts/test-note-table-api.mjs
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
const image = (word) => word.padEnd(200, "A"); // the stand-in picks its answer from the start of the image data

const admin = { email: `qa-nt-admin-${stamp}@example.com` };
const reader = { email: `qa-nt-reader-${stamp}@example.com` };
const plain = { email: `qa-nt-plain-${stamp}@example.com` };
try {
  const { execFileSync } = await import("node:child_process");
  const make = (u, role, perms) => execFileSync("node", ["--env-file=.env.local", "scripts/create-user.mjs", u.email, PW, role, ...perms], { stdio: "pipe" });
  make(admin, "admin", []);
  make(reader, "client", []);
  make(plain, "client", []);
  // The reader may read delivery notes; the other client may not.
  await sql`UPDATE users SET permissions = ARRAY['request','note_table'] WHERE email = ${reader.email}`;

  const ta = await login(admin.email), tr = await login(reader.email), tp = await login(plain.email);
  check("the three throwaway users can sign in", !!ta && !!tr && !!tp, { ta: !!ta, tr: !!tr, tp: !!tp });

  check("without a login there is nothing", (await call("POST", "/api/mobile/notes/read", null, { image: image("OKROWS") })).status === 401);
  check("a user without the permission is refused", (await call("POST", "/api/mobile/notes/read", tp, { image: image("OKROWS") })).status === 403);
  check("an administrator may read", (await call("POST", "/api/mobile/notes/read", ta, { image: image("OKROWS") })).status === 200);

  const bad = await call("POST", "/api/mobile/notes/read", tr, { image: "short" });
  check("a missing photo is refused", bad.status === 400, bad);
  check("a wrong picture type is refused", (await call("POST", "/api/mobile/notes/read", tr, { image: image("OKROWS"), mediaType: "application/pdf" })).status === 400);
  check("a huge photo is refused", (await call("POST", "/api/mobile/notes/read", tr, { image: "A".repeat(4_000_001) })).status === 413);

  // Parsing.
  const ok = await call("POST", "/api/mobile/notes/read", tr, { image: image("OKROWS"), mediaType: "image/jpeg" });
  const b = ok.body;
  check("the lines come back", ok.status === 200 && b.legible === true && Array.isArray(b.rows), ok);
  check("a line with nothing to use is dropped", b.rows.length === 5, b.rows);
  check("item numbers and descriptions are tidied (spaces)", b.rows[0].item === "AB-100" && b.rows[0].description === "Bolt M8 zinc", b.rows[0]);
  check("quantities are kept as written", b.rows[1].delivered === "1.200,5" && b.rows[3].delivered === "2 pcs", b.rows);
  check("a line without an item number is kept", b.rows[2].item === "" && b.rows[2].delivered === "4", b.rows[2]);
  check("the supplier and the note number come back", b.supplier === "Acme Freight AB" && b.noteNumber === "LS-5521", b);

  const two = await call("POST", "/api/mobile/notes/read", tr, { image: image("PAGETWO") });
  check("a second page is read on its own", two.status === 200 && two.body.rows[0].item === "GH-400", two);

  const ill = await call("POST", "/api/mobile/notes/read", tr, { image: image("ILLEGIB") });
  check("a photo that is not a note says so", ill.status === 200 && ill.body.legible === false && ill.body.rows.length === 0 && /cat/.test(ill.body.comment), ill);

  const a401 = await call("POST", "/api/mobile/notes/read", tr, { image: image("AUTH401") });
  check("a refused AI key is explained", a401.status === 502 && /key was refused|nekades/.test(a401.body.error), a401);
  const a429 = await call("POST", "/api/mobile/notes/read", tr, { image: image("BUSY429") });
  check("a busy AI service is explained", a429.status === 502 && /busy|upptagen/.test(a429.body.error), a429);
  const none = await call("POST", "/api/mobile/notes/read", tr, { image: image("NOTOOL_") });
  check("an answer without a table is an error, not an empty table", none.status === 502 && /Could not read|Kunde inte läsa/.test(none.body.error), none);

  // The page itself is only for people with the permission.
  const page = async (token) => (await fetch(BASE + "/notes", { headers: { cookie: `session=${token}` }, redirect: "manual" })).status;
  check("the page opens for a reader", (await page(tr)) === 200);
  check("the page sends others away", (await page(tp)) === 307);
} finally {
  await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'table:' || id FROM users WHERE email LIKE ${"qa-nt-%-" + stamp + "@example.com"})`;
  await sql`DELETE FROM users WHERE email LIKE ${"qa-nt-%-" + stamp + "@example.com"}`;
}
console.log(fails ? `${fails} FAILED` : "All checks passed.");
process.exit(fails ? 1 : 0);
