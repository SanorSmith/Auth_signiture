import Link from "next/link";
import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { decryptPending } from "@/lib/codes";
import { issueRequest } from "@/lib/actions";
import { AutoRefresh } from "../auto-refresh";
import { Shell } from "../shell";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" });

function numberOf(blob: string | null) {
  try {
    return blob ? decryptPending(blob) : "Number not stored";
  } catch {
    return "Number not stored";
  }
}

function Tile({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

// Click a row to read the client's note for that request.
function Note({ note }: { note: string | null }) {
  return (
    <div className="border-t border-line bg-page/60 px-4 py-3 text-sm">
      <p className="mb-0.5 text-xs font-medium text-muted">Client note</p>
      {note ? <p>{note}</p> : <p className="text-muted">No note.</p>}
    </div>
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
  const totals = await sql`
    SELECT (SELECT count(*)::int FROM verifications) AS issued,
           (SELECT count(*)::int FROM reset_requests WHERE handled_at IS NULL) AS resets`;
  const { issued: issuedTotal, resets } = totals[0] as { issued: number; resets: number };

  return (
    <Shell title="Requests" description="Issue verification codes for the numbers clients have scanned." email={s.email} role={s.role} width="lg">
      <AutoRefresh />
      <div className="flex flex-col gap-6">
        {resets > 0 && (
          <Link href="/admin/users" className="alert alert-warn flex items-center justify-between gap-3 hover:opacity-90">
            <span>{resets} password reset request{resets > 1 ? "s" : ""} waiting.</span>
            <span className="font-medium underline">Open Users</span>
          </Link>
        )}

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Tile label="Pending" value={pending.length} tone={pending.length ? "text-warn" : ""} />
          <Tile label="Codes issued" value={issuedTotal} />
          <Tile label="Reset requests" value={resets} tone={resets ? "text-danger" : ""} />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="flex flex-col gap-3 lg:col-span-3">
            <h2 className="font-semibold">Pending requests</h2>
            {pending.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing waiting. New scans appear here.</p>
            )}
            {pending.map((r) => (
              <details key={r.id} className="card overflow-hidden">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-lg font-semibold tracking-wide">{numberOf(r.pending_enc)}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="truncate">{r.email ?? "Deleted user"}</span>
                      <span>·</span>
                      <span>{when(r.created_at)}</span>
                      {r.note && <span className="badge bg-accent-soft text-accent">Note</span>}
                    </span>
                  </span>
                  {/* The button submits the empty form below via its form attribute, so it can sit in the summary. */}
                  <button form={`issue-${r.id}`} className="btn btn-primary btn-sm shrink-0">Generate</button>
                </summary>
                <Note note={r.note} />
                <form id={`issue-${r.id}`} action={issueRequest} hidden>
                  <input type="hidden" name="id" value={r.id} />
                </form>
              </details>
            ))}
          </section>

          <section className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="font-semibold">Last 3 issued</h2>
            {issued.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing issued yet.</p>
            )}
            {issued.map((r) => (
              <details key={r.id} className="card overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-muted">{r.email ?? "Deleted user"}</span>
                    <span className="block text-xs text-muted">{when(r.created_at)}</span>
                    {r.note && <span className="badge mt-1 bg-accent-soft text-accent">Note</span>}
                  </span>
                  <span className="font-mono text-xl font-semibold tracking-widest">{r.vcode.trim()}</span>
                </summary>
                <Note note={r.note} />
              </details>
            ))}
          </section>
        </div>
      </div>
    </Shell>
  );
}
