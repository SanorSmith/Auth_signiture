import Link from "next/link";
import { getT } from "@/lib/lang";
import type { T } from "@/lib/i18n";
import { requirePermission } from "@/lib/session";
import { sql } from "@/lib/db";
import { decryptPending, plainNote } from "@/lib/codes";
import { AutoRefresh } from "../auto-refresh";
import { Shell } from "../shell";
import { PendingActions, RemoveAction } from "./request-actions";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" });

function numberOf(blob: string | null, missing: string) {
  try {
    return blob ? decryptPending(blob) : missing;
  } catch {
    return missing;
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

// Click a row to see who asked, who issued the code, and the client's note.
function Note({ note, askedBy, issuedBy, t }: { note: string | null; askedBy: string | null; issuedBy?: string | null; t: T }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line bg-page/60 px-4 py-3 text-sm">
      <div>
        <p className="mb-0.5 text-xs font-medium text-muted">{t("Asked by")}</p>
        <p className="break-all">{askedBy ?? t("Unknown")}</p>
      </div>
      {issuedBy !== undefined && (
        <div>
          <p className="mb-0.5 text-xs font-medium text-muted">{t("Code issued by")}</p>
          <p className="break-all">{issuedBy ?? t("Unknown")}</p>
        </div>
      )}
      <div>
        <p className="mb-0.5 text-xs font-medium text-muted">{t("Delivery")}</p>
        {note ? <p>{t(plainNote(note))}</p> : <p className="text-muted">{t("No delivery details.")}</p>}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const s = await requirePermission("manage_requests");
  const t = await getT();
  const canSeeResets = s.perms.includes("reset_passwords");
  const pending = await sql`
    SELECT c.id, c.pending_enc, c.note, c.created_at, COALESCE(u.email, c.requested_by_email) AS email FROM codes c
    LEFT JOIN users u ON u.id = c.client_id
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE v.id IS NULL AND c.denied_at IS NULL ORDER BY c.id`;
  const issued = await sql`
    SELECT c.id, c.note, v.vcode, v.created_at,
           COALESCE(u.email, c.requested_by_email) AS email,
           COALESCE(i.email, v.issued_by_email) AS issuer
    FROM verifications v
    JOIN codes c ON c.code_hash = v.code_hash
    LEFT JOIN users u ON u.id = c.client_id
    LEFT JOIN users i ON i.id = v.issued_by
    ORDER BY v.id DESC LIMIT 3`;
  const totals = await sql`
    SELECT (SELECT count(*)::int FROM verifications) AS issued,
           (SELECT count(*)::int FROM reset_requests WHERE handled_at IS NULL) AS resets`;
  const { issued: issuedTotal } = totals[0] as { issued: number };
  // Password reset requests only show for people who may handle them.
  const resets = canSeeResets ? (totals[0] as { resets: number }).resets : 0;

  return (
    <Shell title="Requests" description="Issue verification codes for the numbers clients have scanned." user={s} width="lg">
      <AutoRefresh />
      <div className="flex flex-col gap-6">
        {resets > 0 && (
          <Link href="/admin/users" className="alert alert-warn flex items-center justify-between gap-3 hover:opacity-90">
            <span>{t(`${resets} password reset request${resets > 1 ? "s" : ""} waiting.`)}</span>
            <span className="font-medium underline">{t("Open Users")}</span>
          </Link>
        )}

        <div className={`grid gap-3 sm:gap-4 ${canSeeResets ? "grid-cols-3" : "grid-cols-2"}`}>
          <Tile label={t("Pending")} value={pending.length} tone={pending.length ? "text-warn" : ""} />
          <Tile label={t("Codes issued")} value={issuedTotal} />
          {canSeeResets && <Tile label={t("Reset requests")} value={resets} tone={resets ? "text-danger" : ""} />}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="flex min-w-0 flex-col gap-3 lg:col-span-3">
            <h2 className="font-semibold">{t("Pending requests")}</h2>
            {pending.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{t("Nothing waiting. New scans appear here.")}</p>
            )}
            {pending.map((r) => (
              <div key={r.id} className="card overflow-hidden">
                <details>
                  <summary className="flex cursor-pointer list-none flex-col gap-0.5 px-4 py-3">
                    <span className="font-mono text-lg font-semibold tracking-wide">{numberOf(r.pending_enc, t("Number not stored"))}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="truncate">{t("Asked by")} {r.email ?? t("Unknown")}</span>
                      <span>·</span>
                      <span>{when(r.created_at)}</span>
                    </span>
                    {r.note && <span className="truncate text-sm font-medium text-accent">{t(plainNote(r.note))}</span>}
                  </summary>
                  <Note note={r.note} askedBy={r.email} t={t} />
                </details>
                <div className="border-t border-line px-4 py-2.5">
                  <PendingActions id={r.id} />
                </div>
              </div>
            ))}
          </section>

          <section className="flex min-w-0 flex-col gap-3 lg:col-span-2">
            <h2 className="font-semibold">{t("Last 3 issued")}</h2>
            {issued.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{t("Nothing issued yet.")}</p>
            )}
            {issued.map((r) => (
              <div key={r.id} className="card overflow-hidden">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-muted">{t("Asked by")} {r.email ?? t("Unknown")}</span>
                      <span className="block truncate text-xs text-muted">{t("Issued by")} {r.issuer ?? t("Unknown")}</span>
                      <span className="block text-xs text-muted">{when(r.created_at)}</span>
                      {r.note && <span className="block truncate text-sm font-medium text-accent">{t(plainNote(r.note))}</span>}
                    </span>
                    <span className="font-mono text-xl font-semibold tracking-widest">{r.vcode.trim()}</span>
                  </summary>
                  <Note note={r.note} askedBy={r.email} issuedBy={r.issuer} t={t} />
                </details>
                <div className="border-t border-line px-4 py-2.5">
                  <RemoveAction id={r.id} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </Shell>
  );
}
