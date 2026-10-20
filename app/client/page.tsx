import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../auto-refresh";
import { Header } from "../header";
import { ScanForm } from "./scan-form";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

export default async function ClientPage() {
  const s = await requireRole("client");
  const rows = await sql`
    SELECT c.id, c.created_at, v.vcode FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${s.uid} ORDER BY c.id DESC LIMIT 20`;
  return (
    <>
      <Header title="Request a code" email={s.email} />
      <AutoRefresh />
      <main className="mx-auto flex max-w-md flex-col gap-8 p-6">
        <ScanForm />
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">My requests</h2>
          {rows.length === 0 && <p className="text-sm text-neutral-500">No requests yet.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
              <span className="text-sm text-neutral-500">#{r.id} · {when(r.created_at)}</span>
              {r.vcode ? (
                <span className="font-mono text-2xl tracking-widest">{r.vcode.trim()}</span>
              ) : (
                <span className="text-sm text-amber-600">Waiting for admin…</span>
              )}
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
