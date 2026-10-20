import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../auto-refresh";
import { Header } from "../header";
import { ScanForm } from "./scan-form";

export default async function ClientPage() {
  const s = await requireRole("client");
  // Only the number scanned last is shown, as one big code once the admin has issued it.
  const rows = await sql`
    SELECT v.vcode FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${s.uid} ORDER BY c.last_scanned_at DESC, c.id DESC LIMIT 1`;
  const latest = rows[0] as { vcode: string | null } | undefined;
  return (
    <>
      <Header title="Request a code" email={s.email} />
      <AutoRefresh />
      <main className="mx-auto flex max-w-md flex-col items-center gap-8 p-6">
        <ScanForm />
        {!latest && <p className="text-neutral-500">Scan a number to get your verification code.</p>}
        {latest && !latest.vcode && <p className="text-xl text-amber-600">Waiting for the admin…</p>}
        {latest?.vcode && (
          <p className="font-mono text-6xl font-bold tracking-widest sm:text-8xl">{latest.vcode.trim()}</p>
        )}
      </main>
    </>
  );
}
