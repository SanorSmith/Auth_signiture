import { sql } from "./db";
import { SUPPLIER_MAX } from "./codes";

// Suppliers whose requests get their code at once, without an administrator confirming each one.
// A request is accepted when one word of its supplier name is a word of a name on the list ("Acme" on the
// list accepts "Acme Freight AB" and "Nordic Acme"). Capital letters and punctuation do not matter. Company
// forms such as AB or GmbH do not count as a match on their own, or every "... AB" would be accepted.
// The request still stays in the history, and an administrator can remove it afterwards.
// A supplier can be paused (inactive), and all automatic codes can be paused at once: then the request
// waits for an administrator, who is told about it like any other new request.

export const ALLOW_MAX = 200;
export const AUTO_ISSUER = "Allow list";

const tidy = (v: unknown) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
export const supplierKey = (v: unknown) => tidy(v).toLocaleLowerCase("sv-SE");

const COMPANY_FORMS = new Set(["ab", "aktiebolag", "hb", "kb", "gmbh", "ag", "ltd", "limited", "llc", "inc", "co", "oy", "as", "bv", "nv", "sa", "srl", "spa", "sarl", "plc"]);

// The words of a supplier name that can match: letters and digits, at least two characters, no company form.
export function nameWords(name: unknown): string[] {
  return supplierKey(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !COMPANY_FORMS.has(w));
}

// The name on the list that accepts this supplier, or null. A name made only of company forms (or too short
// to have a word) has to be the same as the supplier.
export function allowedBy(supplier: unknown, names: string[]): string | null {
  const key = supplierKey(supplier);
  if (!key) return null;
  const words = new Set(nameWords(supplier));
  for (const name of names) {
    const own = nameWords(name);
    if (own.length === 0 ? supplierKey(name) === key : own.some((w) => words.has(w))) return name;
  }
  return null;
}

export type AllowedSupplier = { id: number; name: string; addedBy: string | null; at: number; active: boolean };

export async function listAllowed(): Promise<AllowedSupplier[]> {
  const rows = await sql`SELECT id, name, added_by_email, created_at, active FROM allowed_suppliers ORDER BY name`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, addedBy: (r.added_by_email as string | null) ?? null, at: new Date(r.created_at as string).getTime(), active: r.active as boolean }));
}

// Automatic codes as a whole: on unless an administrator paused them (a row in app_settings, like the other switches).
export async function autoCodesOn(): Promise<boolean> {
  const rows = await sql`SELECT value FROM app_settings WHERE key = 'auto_codes'`;
  return rows[0]?.value !== "off";
}

export async function setAutoCodes(on: boolean) {
  await sql`
    INSERT INTO app_settings (key, value) VALUES ('auto_codes', ${on ? "on" : "off"})
    ON CONFLICT (key) DO UPDATE SET value = ${on ? "on" : "off"}`;
}

export async function setSupplierActive(id: number, active: boolean) {
  await sql`UPDATE allowed_suppliers SET active = ${active} WHERE id = ${id}`;
}

export async function isAllowed(supplier: unknown): Promise<boolean> {
  if (!supplierKey(supplier)) return false;
  if (!(await autoCodesOn())) return false;
  const rows = await sql`SELECT name FROM allowed_suppliers WHERE active`;
  return allowedBy(supplier, rows.map((r) => r.name as string)) !== null;
}

export async function addAllowed(nameRaw: unknown, byEmail: string): Promise<{ error: string } | { ok: true }> {
  const name = tidy(nameRaw);
  if (name.length < 2) return { error: "Enter the supplier name" };
  if (name.length > SUPPLIER_MAX) return { error: `The supplier name can be at most ${SUPPLIER_MAX} characters` };
  const count = (await sql`SELECT count(*)::int AS n FROM allowed_suppliers`)[0].n as number;
  if (count >= ALLOW_MAX) return { error: "The list is full" };
  const added = await sql`INSERT INTO allowed_suppliers (name, key, added_by_email) VALUES (${name}, ${supplierKey(name)}, ${byEmail}) ON CONFLICT (key) DO NOTHING RETURNING id`;
  return added.length ? { ok: true } : { error: "This supplier is already on the list" };
}

export async function removeAllowed(id: number) {
  await sql`DELETE FROM allowed_suppliers WHERE id = ${id}`;
}
