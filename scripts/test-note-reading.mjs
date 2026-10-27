// Reads a picture of a delivery note through the live reader and compares it with a scan.
//   BASE_URL=https://... ADMIN_EMAIL=... ADMIN_PASSWORD=... NOTE_IMAGE=note.jpg NOTE_IDS=note-ids.txt \
//     node scripts/test-note-reading.mjs
// NOTE_IDS holds the IDs printed on the picture, one per line. This sends one picture to the AI, so it
// costs a little; it is not part of the regular tests. Uses a real count, so run it with a test account.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3222";
const need = (k) => process.env[k] ?? (console.error(`Set ${k}`), process.exit(2));
const truth = readFileSync(need("NOTE_IDS"), "utf8").split(/\s+/).filter(Boolean);
const image = readFileSync(need("NOTE_IMAGE")).toString("base64");

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const login = await call("POST", "/api/mobile/login", null, { email: need("ADMIN_EMAIL"), password: need("ADMIN_PASSWORD") });
const token = login.body?.token;
if (!token) (console.error("sign-in failed"), process.exit(1));
const C = "/api/mobile/counter";

let failures = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

// Scan all but the last package, as if one had been left off the lorry.
await call("POST", `${C}/cancel`, token);
for (const id of truth.slice(0, -1)) await call("POST", `${C}/scan`, token, { code: id });

const read = await call("POST", `${C}/note-read`, token, { image, mediaType: "image/jpeg" });
check("the reader answers", read.status === 200, read);
const ids = read.body?.ids ?? [];
console.log(`      read ${ids.length} IDs; the note says total ${read.body?.total}; supplier ${read.body?.supplier}`);
check("it found every package ID on the note", truth.every((t) => ids.includes(t)), { truth, ids });
check("it listed nothing else (no phone number, order reference or weight)", ids.every((i) => truth.includes(i)), ids.filter((i) => !truth.includes(i)));
check("it read the printed total", read.body?.total === truth.length, read.body?.total);

const cmp = await call("POST", `${C}/note-compare`, token, { ids });
check("the last package is reported missing", cmp.body?.missing?.join() === truth.at(-1) && cmp.body?.matched?.length === truth.length - 1, cmp.body);

await call("POST", `${C}/cancel`, token);
const after = await call("GET", `${C}/state`, token);
check("everything is gone after cancelling", after.body?.active === false && after.body?.count === 0, after.body);

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
