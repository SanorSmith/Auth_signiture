import { listRememberedRules, noteCompareEnabled } from "@/lib/counter";
import { noteReadingConfigured } from "@/lib/counter-note";
import { forgetAllRememberedRules, forgetRememberedRule, switchNoteCompare } from "@/lib/counter-actions";
import { getT } from "@/lib/lang";
import { requireAdmin } from "@/lib/session";
import { Shell } from "../../shell";
import { CounterTabs } from "../counter-tabs";

const when = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

export default async function RulesPage() {
  const s = await requireAdmin();
  const t = await getT();
  const rules = await listRememberedRules();
  const noteOn = await noteCompareEnabled();
  const keySet = noteReadingConfigured();
  return (
    <Shell
      title="Delivery counter"
      description="What the counter has learned about package codes. Only the shape is kept: the first 3 characters, the length and how many characters must match. Never a whole package code."
      user={s}
      width="lg"
    >
      <CounterTabs current="rules" isAdmin />
      <section className="card mb-4 flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("Compare with delivery note")}</h2>
            <p className="text-sm text-muted">
              {t("Users photograph the delivery note, an AI model reads the package IDs, and they are compared with the scanned packages. The photo is not stored, and the IDs are removed when the count ends.")}
            </p>
          </div>
          <form action={switchNoteCompare}>
            <input type="hidden" name="on" value={noteOn ? "0" : "1"} />
            <button className={`btn btn-sm ${noteOn ? "btn-danger-ghost" : "btn-primary"}`}>{noteOn ? t("Turn off") : t("Turn on")}</button>
          </form>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`badge ${noteOn ? "bg-success-soft text-success" : "border border-line bg-page text-muted"}`}>{noteOn ? t("On") : t("Off")}</span>
          <span className={`badge ${keySet ? "bg-success-soft text-success" : "bg-warn-soft text-warn"}`}>
            {keySet ? t("AI key is set") : t("AI key is missing: reading notes will not work until it is added")}
          </span>
        </p>
      </section>
      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-semibold">{t("Remembered rules")} <span className="font-normal text-muted">({rules.length})</span></h2>
          {rules.length > 0 && (
            <form action={forgetAllRememberedRules}>
              <button className="btn btn-danger-ghost btn-sm">{t("Forget all")}</button>
            </form>
          )}
        </div>
        {rules.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{t("Nothing learned yet. Rules appear here after shipments of three or more packages are finished.")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">{t("Starts with")}</th>
                <th className="px-2 py-2 font-medium">{t("Length")}</th>
                <th className="px-2 py-2 font-medium">{t("Must match")}</th>
                <th className="px-2 py-2 font-medium">{t("May differ")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Times used")}</th>
                <th className="px-2 py-2 font-medium">{t("Last used")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-1.5 font-mono">{r.lead}…</td>
                  <td className="px-2 py-1.5">{r.len}</td>
                  <td className="px-2 py-1.5">{t(`first ${r.prefix}`)}</td>
                  <td className="px-2 py-1.5">{t(`last ${r.len - r.prefix}`)}</td>
                  <td className="px-2 py-1.5 text-right">{r.uses}</td>
                  <td className="px-2 py-1.5">{when(r.lastUsed)}</td>
                  <td className="px-4 py-1.5 text-right">
                    <form action={forgetRememberedRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn btn-danger-ghost btn-sm">{t("Forget")}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
