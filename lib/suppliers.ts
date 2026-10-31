import { sql } from "./db";
import { listAllowed, supplierKey } from "./allow-list";
import { SUPPLIER_MAX } from "./codes";

// Supplier names offered while someone fills in a request: the ones this person used before (the most
// recent first), then the ones on the allow list, written the way the list has them. A name appears once.
const LIMIT = 60;

export async function supplierSuggestions(uid: number): Promise<string[]> {
  const mine = await sql`
    SELECT split_part(note, ' · ', 1) AS name, max(last_scanned_at) AS last
    FROM codes WHERE client_id = ${uid} AND note IS NOT NULL
    GROUP BY 1 ORDER BY last DESC LIMIT 40`;
  const allowed = (await listAllowed()).map((a) => a.name);
  const spelled = new Map(allowed.map((n) => [supplierKey(n), n]));

  const out = new Map<string, string>();
  for (const r of mine) {
    const name = String(r.name ?? "").trim();
    if (name.length < 2 || name.length > SUPPLIER_MAX || /^\d/.test(name)) continue;
    const key = supplierKey(name);
    if (!out.has(key)) out.set(key, spelled.get(key) ?? name);
  }
  for (const name of allowed) if (!out.has(supplierKey(name))) out.set(supplierKey(name), name);
  return [...out.values()].slice(0, LIMIT);
}
