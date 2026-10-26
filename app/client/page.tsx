import { getT } from "@/lib/lang";
import { requirePermission } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../auto-refresh";
import { Shell } from "../shell";
import { ResultTone } from "./result-tone";
import { ScanForm } from "./scan-form";

const when = (d: string) => new Date(d).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" });

export default async function ClientPage() {
  const s = await requirePermission("request");
  const t = await getT();
  // The big code is the number scanned last; below it, the last three codes the admin issued.
  const rows = await sql`
    SELECT v.vcode, c.denied_at FROM codes c
    LEFT JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${s.uid} ORDER BY c.last_scanned_at DESC, c.id DESC LIMIT 1`;
  const history = await sql`
    SELECT v.vcode, v.created_at, c.note FROM codes c
    JOIN verifications v ON v.code_hash = c.code_hash
    WHERE c.client_id = ${s.uid} ORDER BY v.id DESC LIMIT 3`;
  const latest = rows[0] as { vcode: string | null; denied_at: string | null } | undefined;

  return (
    <Shell title="Request a code" description="Scan the 10-digit number to get its verification code." user={s}>
      <AutoRefresh />
      <ResultTone vcode={latest?.vcode?.trim() ?? null} denied={!!latest?.denied_at} />
      <div className="flex flex-col gap-3 sm:gap-5">
        <section className="card p-4 sm:p-6">
          <ScanForm />
        </section>

        {/* On a handheld the code sits above the scan form so a scan and its result are both on screen. */}
        <div className="order-first sm:order-none">
          {!latest && (
            <section className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted sm:p-8">
              {t("No code yet. Scan a number to get started.")}
            </section>
          )}
          {latest && !latest.vcode && latest.denied_at && (
            <section className="card border-danger/40 bg-danger-soft p-4 text-center text-danger sm:p-6" role="alert">
              <p className="text-lg font-semibold">{t("Request denied")}</p>
              <p className="mt-1 text-sm opacity-90">{t("The admin denied this request. Scan the number again to ask once more.")}</p>
            </section>
          )}
          {latest && !latest.vcode && !latest.denied_at && (
            <section className="card flex items-center justify-center gap-3 p-5 text-warn sm:p-8" role="status">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-warn" />
              <span className="font-medium">{t("Waiting for the admin…")}</span>
            </section>
          )}
          {latest?.vcode && (
            <section className="card bg-accent-soft p-4 text-center sm:p-8">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">{t("Your verification code")}</p>
              {/* Scales with the screen width so the 6 characters always fit, even on small handhelds. */}
              <p className="mt-1 whitespace-nowrap font-mono text-[clamp(2rem,15vw,6rem)] font-bold tracking-widest text-accent sm:mt-2">{latest.vcode.trim()}</p>
            </section>
          )}
        </div>

        {history.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">{t(`Last ${history.length} verified code${history.length > 1 ? "s" : ""}`)}</h2>
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={`${h.vcode}-${h.created_at}`} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{when(h.created_at)}</p>
                    {h.note && <p className="truncate text-sm">{t(h.note)}</p>}
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
