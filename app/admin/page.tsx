import Link from "next/link";
import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { decryptPending } from "@/lib/codes";
import { issueRequest } from "@/lib/actions";
import { AutoRefresh } from "../auto-refresh";
import { Header } from "../header";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

function numberOf(blob: string | null) {
  try {
    return blob ? decryptPending(blob) : "(number not stored)";
  } catch {
    return "(number not stored)";
  }
}

// Click a row to read the client's note for that request.
function Note({ note }: { note: string | null }) {
  return note ? (
    <p className="border-t px-3 py-2 text-sm">{note}</p>
  ) : (
    <p className="border-t px-3 py-2 text-sm text-neutral-500">No note.</p>
  );
}

export default async function AdminPage() {
  const s = await requireRole("admin");
  const pending = await sql`
    SELECT c.id, c.pending_enc, c.note, c.created_at, u.email FROM codes c
    LEFT JOIN users u ON u.id = c.client_id
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE v.id IS NULL ORDER BY c.id`;
  const issued = await sql`
    SELECT c.id, c.note, v.vcode, v.created_at, u.email FROM verifications v
    JOIN codes c ON c.code_hash = v.code_hash
    LEFT JOIN users u ON u.id = c.client_id ORDER BY v.id DESC LIMIT 3`;
  const resets = await sql`SELECT count(*)::int AS n FROM reset_requests WHERE handled_at IS NULL`;
  const resetCount: number = resets[0].n;

  return (
    <>
      <Header title="Admin" email={s.email} role={s.role} />
      <AutoRefresh />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
        {resetCount > 0 && (
          <Link href="/admin/users" className="rounded border border-red-500 p-3 text-sm text-red-600">
            {resetCount} password reset request{resetCount > 1 ? "s" : ""} waiting. Open Users to handle {resetCount > 1 ? "them" : "it"}.
          </Link>
        )}

        <h2 className="font-semibold">Pending requests ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-neutral-500">No pending requests.</p>}
        {pending.map((r) => (
          <div key={r.id} className="flex items-start gap-2">
            <details className="min-w-0 flex-1 rounded border">
              <summary className="cursor-pointer px-3 py-2">
                <span className="font-mono text-lg">{numberOf(r.pending_enc)}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {r.email ?? "(deleted user)"} · {when(r.created_at)}{r.note ? " · has a note" : ""}
                </span>
              </summary>
              <Note note={r.note} />
            </details>
            <form action={issueRequest}>
              <input type="hidden" name="id" value={r.id} />
              <button className="rounded bg-black px-3 py-3 text-sm text-white dark:bg-white dark:text-black">Generate</button>
            </form>
          </div>
        ))}

        <h2 className="mt-4 font-semibold">Last 3 issued</h2>
        {issued.length === 0 && <p className="text-sm text-neutral-500">Nothing issued yet.</p>}
        {issued.map((r) => (
          <details key={r.id} className="rounded border">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate text-xs text-neutral-500">
                {r.email ?? "(deleted user)"} · {when(r.created_at)}{r.note ? " · has a note" : ""}
              </span>
              <span className="font-mono text-lg tracking-widest">{r.vcode.trim()}</span>
            </summary>
            <Note note={r.note} />
          </details>
        ))}
      </main>
    </>
  );
}
