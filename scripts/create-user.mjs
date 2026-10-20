// Usage: node --env-file=.env.local scripts/create-user.mjs <email> <password> <admin|client|monitor>
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const [email, password, role] = process.argv.slice(2);
if (!email || !password || !["admin", "client", "monitor"].includes(role)) {
  console.error("Usage: create-user.mjs <email> <password> <admin|client|monitor>");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  INSERT INTO users (email, password_hash, role)
  VALUES (${email.toLowerCase()}, ${await bcrypt.hash(password, 10)}, ${role})
  ON CONFLICT (email) DO NOTHING RETURNING id`;
console.log(rows.length ? `Created ${role} ${email}` : "Email already exists");
