import { sql } from "./db";
import type { NoteRow } from "./note-table";

// The table a person has built up from delivery notes and keeps until it is cleared, so it can be opened on the
// phone and on a computer. One table per person: the lines in order, nothing else (no photos).
export const MAX_SAVED_ROWS = 2000;

const tidy = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function cleanRows(input: unknown): NoteRow[] | null {
  if (!Array.isArray(input) || input.length > MAX_SAVED_ROWS) return null;
  const out: NoteRow[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const row = { item: tidy(o.item, 40), delivered: tidy(o.delivered, 20), description: tidy(o.description, 120) };
    if (row.item || row.delivered || row.description) out.push(row);
  }
  return out;
}

export async function listSaved(userId: number): Promise<NoteRow[]> {
  const rows = await sql`SELECT item, delivered, description FROM saved_note_rows WHERE user_id = ${userId} ORDER BY position, id`;
  return rows.map((r) => ({ item: String(r.item), delivered: String(r.delivered), description: String(r.description) }));
}

// Replaces the whole table in one step, so two screens never leave a half-written table.
export async function replaceSaved(userId: number, rows: NoteRow[]) {
  await sql.transaction([
    sql`DELETE FROM saved_note_rows WHERE user_id = ${userId}`,
    sql`INSERT INTO saved_note_rows (user_id, position, item, delivered, description)
        SELECT ${userId}, p, i, d, s FROM unnest(${rows.map((_, n) => n)}::int[], ${rows.map((r) => r.item)}::text[], ${rows.map((r) => r.delivered)}::text[], ${rows.map((r) => r.description)}::text[]) AS t(p, i, d, s)`,
  ]);
}

export async function clearSaved(userId: number) {
  await sql`DELETE FROM saved_note_rows WHERE user_id = ${userId}`;
}
