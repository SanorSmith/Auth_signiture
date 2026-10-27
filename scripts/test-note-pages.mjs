// A delivery note of two pages: read each page, merge the lists the way the screens do, compare.
//   BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... PAGE1=a.jpg IDS1=a-ids.txt PAGE2=b.jpg IDS2=b-ids.txt \
//     node scripts/test-note-pages.mjs
// Costs two reads. The last ID of page 1 is repeated at the top of page 2, as happens when a list runs over.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3222";
const need = (k) => process.env[k] ?? (console.error(`Set ${k}`), process.exit(2));
const ids1 = readFileSync(need("IDS1"), "utf8").split(/\s+/).filter(Boolean);
const ids2 = readFileSync(need("IDS2"), "utf8").split(/\s+/).filter(Boolean);
const all = [...new Set([...ids1, ...ids2])];

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const token = (await call("POST", "/api/mobile/login", null, { email: need("ADMIN_EMAIL"), password: need("ADMIN_PASSWORD") })).body?.token;
if (!token) (console.error("sign-in failed"), process.exit(1));
const C = "/api/mobile/counter";
let failures = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

// Everything on the whole note was scanned except the last package.
await call("POST", `${C}/cancel`, token);
for (const id of all.slice(0, -1)) await call("POST", `${C}/scan`, token, { code: id });

const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const page1 = await call("POST", `${C}/note-read`, token, { image: readFileSync(need("PAGE1")).toString("base64"), mediaType: "image/jpeg" });
const page2 = await call("POST", `${C}/note-read`, token, { image: readFileSync(need("PAGE2")).toString("base64"), mediaType: "image/jpeg" });
check("both pages are read", page1.status === 200 && page2.status === 200, { a: page1.status, b: page2.status });

// The merge the screens do: keep the list, add only the IDs not seen before.
const have = page1.body.ids;
const known = new Set(have.map(norm));
const fresh = page2.body.ids.filter((id) => !known.has(norm(id)));
const merged = [...have, ...fresh];
check("an ID repeated on the next page is not added twice", merged.length === new Set(merged.map(norm)).size, merged);
check("the merged list holds every ID of both pages", all.every((id) => merged.includes(id)), { all, merged });

const cmp = (await call("POST", `${C}/note-compare`, token, { ids: merged })).body;
check("the package left unscanned is the only one missing", cmp?.missing?.join() === all.at(-1) && cmp.matched.length === all.length - 1 && !cmp.extra.length, cmp);

await call("POST", `${C}/cancel`, token);
if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
