import Link from "next/link";
import { getT } from "@/lib/lang";
import { addDays, counterStats, parseRange, previousRange, todayStockholm, type Stats, type Unit } from "@/lib/counter";
import type { T } from "@/lib/i18n";
import { requirePermission } from "@/lib/session";
import { Shell } from "../../shell";
import { CounterTabs } from "../counter-tabs";

type Search = { unit?: string; from?: string; to?: string; cmpFrom?: string; cmpTo?: string; scope?: string; compare?: string | string[] };

const label = (start: string, unit: Unit) => (unit === "month" ? start.slice(0, 7) : start.slice(5));

function Delta({ now, before, t }: { now: number; before: number | null; t: T }) {
  if (before === null) return null;
  if (before === 0) return <span className="text-xs text-muted">{now === 0 ? "–" : t("new")}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const tone = pct === 0 ? "text-muted" : pct > 0 ? "text-success" : "text-danger";
  return <span className={`text-xs font-medium ${tone}`}>{pct > 0 ? "▲" : pct < 0 ? "▼" : "="} {Math.abs(pct)}%</span>;
}

function Kpi({ title, value, before, t, decimals = false }: { title: string; value: number; before: number | null; t: T; decimals?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs font-medium text-muted">{title}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{decimals ? value.toFixed(1) : value}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <Delta now={value} before={before} t={t} />
        {before !== null && <span className="text-xs text-muted">{t("before")}: {decimals ? before.toFixed(1) : before}</span>}
      </div>
    </div>
  );
}

// Two bars per period slot: this period, and the one it is compared with.
function Chart({ title, a, b, pick, t }: { title: string; a: Stats; b: Stats | null; pick: "shipments" | "colli"; t: T }) {
  const slots = Math.max(a.buckets.length, b?.buckets.length ?? 0);
  const max = Math.max(1, ...a.buckets.map((x) => x[pick]), ...(b?.buckets.map((x) => x[pick]) ?? [0]));
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />{t("This period")}</span>
          {b && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted/50" />{t("Compared with")}</span>}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex h-44 items-end gap-1" style={{ minWidth: `${Math.min(slots, 60) * 22}px` }}>
          {Array.from({ length: slots }, (_, i) => {
            const x = a.buckets[i];
            const y = b?.buckets[i];
            return (
              <div key={i} className="flex h-full min-w-4 flex-1 flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-px">
                  {y && <div title={`${y.start}: ${y[pick]}`} className="w-1/2 rounded-t bg-muted/50" style={{ height: `${(y[pick] / max) * 100}%` }} />}
                  {x && <div title={`${x.start}: ${x[pick]}`} className="w-1/2 rounded-t bg-accent" style={{ height: `${(x[pick] / max) * 100}%` }} />}
                </div>
                <span className="mt-1 truncate text-center text-[10px] text-muted">{x ? label(x.start, a.unit) : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const s = await requirePermission("colli_counter");
  const t = await getT();
  const q = await searchParams;

  const range = parseRange({ unit: q.unit, from: q.from, to: q.to });
  const mine = q.scope === "mine" ? s.uid : null;
  const compareOn = Array.isArray(q.compare) ? q.compare.includes("1") : q.compare !== "0";
  const prev = previousRange(range);
  const other = compareOn ? parseRange({ unit: range.unit, from: q.cmpFrom ?? prev.from, to: q.cmpTo ?? prev.to }) : null;

  const a = await counterStats(range, mine);
  const b = other ? await counterStats(other, mine) : null;

  const today = todayStockholm();
  const link = (from: string, to: string, extra: Partial<Search> = {}) => {
    const p = new URLSearchParams({ unit: range.unit, from, to, ...(mine ? { scope: "mine" } : {}), ...(compareOn ? {} : { compare: "0" }), ...extra } as Record<string, string>);
    return `/counter/dashboard?${p}`;
  };
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const presets: [string, string, string, Partial<Search>][] = [
    ["Last 7 days", addDays(today, -6), today, { unit: "day" }],
    ["Last 30 days", addDays(today, -29), today, { unit: "day" }],
    ["This month", monthStart, today, { unit: "day" }],
    ["Last month", `${lastMonthEnd.slice(0, 7)}-01`, lastMonthEnd, { unit: "day" }],
    ["Last 12 weeks", addDays(today, -83), today, { unit: "week" }],
    ["Last 12 months", addDays(today, -364), today, { unit: "month" }],
  ];

  const field = "input py-1.5 text-sm";
  return (
    <Shell title="Colli counter" description="Shipments counted and colli received, by day, week or month, and compared between two periods." user={s} width="lg">
      <CounterTabs current="stats" />
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {presets.map(([name, from, to, extra]) => (
              <Link key={name} href={link(from, to, extra)} className="btn btn-secondary btn-sm">{t(name)}</Link>
            ))}
          </div>
          <form method="get" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-muted">{t("From")}<input type="date" name="from" defaultValue={range.from} className={field} /></label>
            <label className="text-xs text-muted">{t("To")}<input type="date" name="to" defaultValue={range.to} className={field} /></label>
            <label className="text-xs text-muted">{t("Group by")}
              <select name="unit" defaultValue={range.unit} className={field}>
                <option value="day">{t("Day")}</option>
                <option value="week">{t("Week")}</option>
                <option value="month">{t("Month")}</option>
              </select>
            </label>
            <label className="text-xs text-muted">{t("Show")}
              <select name="scope" defaultValue={mine ? "mine" : "team"} className={field}>
                <option value="team">{t("Everyone")}</option>
                <option value="mine">{t("Only me")}</option>
              </select>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4">
              <input type="hidden" name="compare" value="0" />
              <input type="checkbox" name="compare" value="1" defaultChecked={compareOn} className="h-4 w-4 accent-[var(--accent)]" />
              {t("Compare with another period")}
            </label>
            {compareOn && (
              <>
                <label className="text-xs text-muted">{t("Compare from")}<input type="date" name="cmpFrom" defaultValue={other?.from} className={field} /></label>
                <label className="text-xs text-muted">{t("Compare to")}<input type="date" name="cmpTo" defaultValue={other?.to} className={field} /></label>
              </>
            )}
            <div className="col-span-2 sm:col-span-4"><button className="btn btn-primary btn-sm">{t("Show statistics")}</button></div>
          </form>
          <p className="text-xs text-muted">
            {t("This period")}: {a.from} – {a.to}
            {other && <> · {t("Compared with")}: {other.from} – {other.to}</>}
          </p>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Kpi title={t("Shipments")} value={a.shipments} before={b ? b.shipments : null} t={t} />
          <Kpi title={t("Colli")} value={a.colli} before={b ? b.colli : null} t={t} />
          <Kpi title={t("Colli per shipment")} value={a.average} before={b ? b.average : null} t={t} decimals />
        </div>
        {a.withExpected > 0 && (
          <p className="text-sm text-muted">{t(`${a.mismatched} of ${a.withExpected} shipments with an expected number differed from it.`)}</p>
        )}

        <Chart title={t("Shipments")} a={a} b={b} pick="shipments" t={t} />
        <Chart title={t("Colli")} a={a} b={b} pick="colli" t={t} />

        <section className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">{t("Period")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Shipments")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Colli")}</th>
                {b && <th className="px-2 py-2 text-right font-medium">{t("Shipments")} ({t("before")})</th>}
                {b && <th className="px-4 py-2 text-right font-medium">{t("Colli")} ({t("before")})</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {a.buckets.map((x, i) => (
                <tr key={x.start}>
                  <td className="px-4 py-1.5">{x.start}</td>
                  <td className="px-2 py-1.5 text-right">{x.shipments}</td>
                  <td className="px-2 py-1.5 text-right">{x.colli}</td>
                  {b && <td className="px-2 py-1.5 text-right text-muted">{b.buckets[i]?.shipments ?? ""}</td>}
                  {b && <td className="px-4 py-1.5 text-right text-muted">{b.buckets[i]?.colli ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Shell>
  );
}
