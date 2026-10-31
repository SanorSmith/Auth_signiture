import { sql } from "./db";
import { SUPPLIER_MAX } from "./codes";

// Suppliers whose requests get their code at once, without an administrator confirming each one.
// A supplier is on the list when its name, ignoring capital letters and extra spaces, is the same.
// The request still stays in the history, and an administrator can remove it afterwards.

export const ALLOW_MAX = 200;
export const AUTO_ISSUER = "Allow list";

const tidy = (v: unknown) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
export const supplierKey = (v: unknown) => tidy(v).toLocaleLowerCase("sv-SE");

export type AllowedSupplier = { id: number; name: string; addedBy: string | null; at: number };

export async function listAllowed(): Promise<AllowedSupplier[]> {
  const rows = await sql`SELECT id, name, added_by_email, created_at FROM allowed_suppliers ORDER BY name`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, addedBy: (r.added_by_email as string | null) ?? null, at: new Date(r.created_at as string).getTime() }));
}

export async function isAllowed(supplier: unknown): Promise<boolean> {
  const key = supplierKey(supplier);
  if (!key) return false;
  return (await sql`SELECT 1 FROM allowed_suppliers WHERE key = ${key} LIMIT 1`).length > 0;
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
