import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../auto-refresh";
import { Shell } from "../shell";
import { ScanForm } from "./scan-form";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" });

export default async function ClientPage() {
  const s = await requireRole("client");
  // The big code is the number scanned last; below it, the last three codes the admin issued.
  const rows = await sql`
    SELECT v.vcode FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${s.uid} ORDER BY c.last_scanned_at DESC, c.id DESC LIMIT 1`;
  const history = await sql`
    SELECT v.vcode, v.created_at, c.note FROM codes c
    JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${s.uid} ORDER BY v.id DESC LIMIT 3`;
  const latest = rows[0] as { vcode: string | null } | undefined;

  return (
    <Shell title="Request a code" description="Scan the 10-digit number to get its verification code." email={s.email} role={s.role}>
      <AutoRefresh />
      <div className="flex flex-col gap-5">
        <section className="card p-5 sm:p-6">
          <ScanForm />
        </section>

        {!latest && (
          <section className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            No code yet. Scan a number to get started.
          </section>
        )}
        {latest && !latest.vcode && (
          <section className="card flex items-center justify-center gap-3 p-8 text-warn" role="status">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-warn" />
            <span className="font-medium">Waiting for the admin…</span>
          </section>
        )}
        {latest?.vcode && (
          <section className="card bg-accent-soft p-6 text-center sm:p-8">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Your verification code</p>
            <p className="mt-2 break-all font-mono text-6xl font-bold tracking-widest text-accent sm:text-8xl">{latest.vcode.trim()}</p>
          </section>
        )}

        {history.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Last {history.length} verified code{history.length > 1 ? "s" : ""}</h2>
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={`${h.vcode}-${h.created_at}`} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{when(h.created_at)}</p>
                    {h.note && <p className="truncate text-sm">{h.note}</p>}
                  </div>
                  <span className="font-mono text-xl font-semibold tracking-widest">{h.vcode.trim()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  );
}
