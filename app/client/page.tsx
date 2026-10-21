import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../auto-refresh";
import { Header } from "../header";
import { ScanForm } from "./scan-form";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

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
    <>
      <Header title="Request a code" email={s.email} role={s.role} />
      <AutoRefresh />
      <main className="mx-auto flex max-w-md flex-col items-center gap-8 p-4 sm:p-6">
        <ScanForm />
        {!latest && <p className="text-neutral-500">Scan a number to get your verification code.</p>}
        {latest && !latest.vcode && <p className="text-xl text-amber-600">Waiting for the admin…</p>}
        {latest?.vcode && (
          <p className="font-mono text-6xl font-bold tracking-widest sm:text-8xl">{latest.vcode.trim()}</p>
        )}
        {history.length > 0 && (
          <section className="flex w-full flex-col gap-2">
            <h2 className="text-sm font-semibold text-neutral-500">Last {history.length} verified code{history.length > 1 ? "s" : ""}</h2>
            {history.map((h) => (
              <div key={`${h.vcode}-${h.created_at}`} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                <span className="min-w-0 text-xs text-neutral-500">
                  <span className="block">{when(h.created_at)}</span>
                  {h.note && <span className="block truncate">{h.note}</span>}
                </span>
                <span className="font-mono text-2xl tracking-widest">{h.vcode.trim()}</span>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
