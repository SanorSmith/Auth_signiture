import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { decryptPending } from "@/lib/codes";
import { issueRequest } from "@/lib/actions";
import { AutoRefresh } from "../auto-refresh";
import { Header } from "../header";
import { UserForm } from "./forms";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

function numberOf(blob: string | null) {
  try {
    return blob ? decryptPending(blob) : "(number not stored)";
  } catch {
    return "(number not stored)";
  }
}

export default async function AdminPage() {
  const s = await requireRole("admin");
  const pending = await sql`
    SELECT c.id, c.pending_enc, c.created_at, u.email FROM codes c
    JOIN users u ON u.id = c.client_id
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE v.id IS NULL ORDER BY c.id`;
  const issued = await sql`
    SELECT c.id, v.vcode, v.created_at, u.email FROM verifications v
    JOIN codes c ON c.code_hash = v.code_hash
    JOIN users u ON u.id = c.client_id ORDER BY v.id DESC LIMIT 10`;
  return (
    <>
      <Header title="Admin" email={s.email} />
      <AutoRefresh />
      <main className="mx-auto grid max-w-4xl gap-10 p-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Pending requests ({pending.length})</h2>
          {pending.length === 0 && <p className="text-sm text-neutral-500">No pending requests.</p>}
          {pending.map((r) => (
            <form key={r.id} action={issueRequest} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
              <input type="hidden" name="id" value={r.id} />
              <div className="min-w-0">
                <p className="font-mono text-lg">{numberOf(r.pending_enc)}</p>
                <p className="truncate text-xs text-neutral-500">{r.email} · {when(r.created_at)}</p>
              </div>
              <button className="shrink-0 rounded bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">Generate</button>
            </form>
          ))}
          <h2 className="mt-4 font-semibold">Recently issued</h2>
          {issued.length === 0 && <p className="text-sm text-neutral-500">Nothing issued yet.</p>}
          {issued.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
              <span className="truncate text-xs text-neutral-500">{r.email} · {when(r.created_at)}</span>
              <span className="font-mono text-lg tracking-widest">{r.vcode.trim()}</span>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Create user</h2>
          <UserForm />
        </section>
      </main>
    </>
  );
}
