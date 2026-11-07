// Makes (or removes) a throwaway user who may read delivery notes, for trying the page by hand.
//   node --env-file=.env.local scripts/make-note-reader.mjs make qa-nr@example.com 'Password-1'
//   node --env-file=.env.local scripts/make-note-reader.mjs remove qa-nr@example.com
// Prints a session token for the mobile API (it also works as the `session` cookie on localhost).
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const [action, email, password] = process.argv.slice(2);
const sql = neon(process.env.DATABASE_URL);
if (action === "remove") {
  await sql`DELETE FROM users WHERE email = ${email}`;
  console.log("removed");
} else {
  await sql`INSERT INTO users (email, password_hash, role, permissions) VALUES (${email}, ${await bcrypt.hash(password, 10)}, 'client', ARRAY['request','note_table']) ON CONFLICT (email) DO NOTHING`;
  const res = await fetch((process.env.BASE_URL ?? "http://localhost:3222") + "/api/mobile/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  console.log((await res.json()).token ?? "sign-in failed");
}
