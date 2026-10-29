"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  adjustGroup,
  adjustMatch,
  cancelCount,
  finishCount,
  mergeGroups,
  removeGroup,
  resolveScan,
  scanPackage,
  setCounterMode,
  setExpected,
  setGroupExpected,
  undoScan,
} from "@/lib/counter-actions";
import type { CounterState, Finished, GroupState } from "@/lib/counter";
import { signal } from "@/lib/tones";
import { useT } from "../lang-provider";
import { ScanInput } from "../scan-input";
import { NoteCompare } from "./note-compare";

const EMPTY: CounterState = { multi: false, groups: [], active: false, count: 0, reference: null, rule: null, expected: null, source: null, noteCompare: false, recent: [] };

type Kind = "counted" | "duplicate" | "forced" | "ignored" | "new";
type Entry = { code: string; kind: Kind; delivery?: number };
type Confirm =
  | { kind: "undo" | "cancel" | "finish" }
  | { kind: "remove"; group: number }
  | { kind: "merge"; from: number; into: number }
  | null;

const BADGE: Record<Kind, string> = {
  counted: "bg-success-soft text-success",
  duplicate: "bg-warn-soft text-warn",
  forced: "bg-warn-soft text-warn",
  ignored: "border border-line bg-page text-muted",
  new: "bg-accent-soft text-accent",
};
const SOURCE = { memory: "From earlier counts", scans: "Learned from these scans", adjusted: "Adjusted by you" } as const;
const LABEL: Record<Kind, string> = {
  counted: "Counted",
  duplicate: "Already counted",
  forced: "Counted anyway",
  ignored: "Ignored",
  new: "New delivery",
};

// The counting screen. Scan each package of a delivery: the app learns from the first two which part of the
// code identifies the delivery, counts the packages that fit, and warns (with a sound) about a package scanned
// twice or one that belongs to another delivery. With several deliveries on one truck, the count has a card
// for each: a package joins the delivery it fits, or starts a new one.
export function CounterPanel({ initial }: { initial: CounterState }) {
  const t = useT();
  const [state, setState] = useState(initial);
  const [feed, setFeed] = useState<Entry[]>([]);
  const [pending, setPending] = useState<string | null>(null); // a package that does not fit, waiting for a decision
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastGroup, setLastGroup] = useState<number | null>(null);
  const [mergeInto, setMergeInto] = useState<Record<number, number>>({});
  const [resetKey, setResetKey] = useState(0);
  const [busy, startBusy] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const locked = pending !== null || confirm !== null || result !== null || busy;
  const multi = state.multi;
  const numberOf = (s: CounterState, id: number | null | undefined) => s.groups.find((g) => g.id === id)?.number;
  const remember = useCallback((code: string, kind: Kind, delivery?: number) => setFeed((f) => [{ code, kind, delivery }, ...f].slice(0, 8)), []);

  // Keep the scan box focused, so the scanner can type into it as soon as nothing else is open.
  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [locked]);

  // A package that does not fit keeps sounding every few seconds until the person decides.
  useEffect(() => {
    if (!pending) return;
    void signal("mismatch");
    const timer = setInterval(() => void signal("mismatch"), 4000);
    return () => clearInterval(timer);
  }, [pending]);

  const scan = (raw: string) => {
    const code = raw.trim();
    if (!code || locked) return;
    setError(null);
    setNotice(null);
    startBusy(async () => {
      const res = await scanPackage(code);
      setState(res.state);
      if (res.group) setLastGroup(res.group);
      if (res.outcome === "invalid") {
        setError("Not a valid package code");
        void signal("error");
      } else if (res.outcome === "counted") {
        remember(res.code!, "counted", numberOf(res.state, res.group));
        void signal("counted");
      } else if (res.outcome === "new_delivery") {
        remember(res.code!, "new", numberOf(res.state, res.group));
        void signal("delivery");
      } else if (res.outcome === "duplicate") {
        remember(res.code!, "duplicate");
        void signal("duplicate");
      } else {
        setPending(res.code);
      }
      setResetKey((k) => k + 1);
    });
  };

  const decide = (choice: "ignore" | "count" | "new" | "delivery") => {
    const code = pending;
    if (!code) return;
    startBusy(async () => {
      const res = await resolveScan(code, choice);
      setPending(null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setState(res.state);
      if (choice === "ignore") {
        remember(code, "ignored");
        void signal("deleted");
      } else if (choice === "count") {
        remember(code, "forced");
        void signal("counted");
      } else if (choice === "delivery") {
        const newest = res.state.groups.at(-1);
        if (newest) setLastGroup(newest.id);
        remember(code, "new", newest?.number);
        void signal("delivery");
      } else {
        setFeed([{ code, kind: "counted" }]);
        setNotice(res.finished ? `Previous shipment saved: ${res.finished.colli} colli` : null);
        void signal("finished");
      }
      setResetKey((k) => k + 1);
    });
  };

  const run = (c: Exclude<Confirm, null>) =>
    startBusy(async () => {
      setConfirm(null);
      setError(null);
      if (c.kind === "undo") {
        setState(await undoScan());
        setFeed((f) => {
          const i = f.findIndex((x) => x.kind === "counted" || x.kind === "forced" || x.kind === "new");
          return i < 0 ? f : f.filter((_, j) => j !== i);
        });
        void signal("deleted");
      } else if (c.kind === "cancel") {
        setState(await cancelCount());
        setFeed([]);
        setLastGroup(null);
        void signal("deleted");
      } else if (c.kind === "remove") {
        setState(await removeGroup(c.group));
        void signal("deleted");
      } else if (c.kind === "merge") {
        setState(await mergeGroups(c.from, c.into));
        setLastGroup(c.into);
        void signal("done");
      } else {
        const res = await finishCount();
        if ("error" in res) {
          setError(res.error);
          void signal("error");
        } else {
          setResult({ colli: res.colli, expected: res.expected, deliveries: res.deliveries });
          setState(EMPTY);
          setFeed([]);
          setLastGroup(null);
          void signal("finished");
        }
      }
      setResetKey((k) => k + 1);
    });

  const chooseMode = (wantMulti: boolean) =>
    startBusy(async () => {
      setError(null);
      const res = await setCounterMode(wantMulti);
      if ("error" in res) {
        setError(res.error);
        void signal("error");
        return;
      }
      setState(res.state);
      void signal("done");
    });

  const saveExpected = (value: string) => {
    const n = value.trim() === "" ? null : Number(value);
    startBusy(async () => setState(await setExpected(n !== null && Number.isFinite(n) ? n : null)));
  };
  const saveGroupExpected = (id: number, value: string) => {
    const n = value.trim() === "" ? null : Number(value);
    startBusy(async () => setState(await setGroupExpected(id, n !== null && Number.isFinite(n) ? n : null)));
  };

  const rule = state.rule;
  const ref = state.reference;

  // ---- the result of a finished count ----
  if (result) {
    const list = result.deliveries && result.deliveries.length > 1 ? result.deliveries : null;
    const diff = result.expected === null ? null : result.colli - result.expected;
    return (
      <section className="card flex flex-col items-center gap-3 p-6 text-center" role="status">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{list ? t("Deliveries counted") : t("Shipment counted")}</p>
        <p className="font-mono text-[clamp(3rem,22vw,7rem)] font-bold leading-none text-success">{result.colli}</p>
        <p className="text-lg font-medium">{t("colli received")}</p>
        {list && (
          <ul className="w-full divide-y divide-line rounded-lg border border-line text-left">
            {list.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>{t("Delivery")} {i + 1}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold">{d.colli}</span>
                  {d.expected !== null && (
                    <span className={`badge ${d.colli === d.expected ? "bg-success-soft text-success" : "bg-warn-soft text-warn"}`}>
                      {d.colli === d.expected ? t(`Matches the expected ${d.expected}`) : t(`Expected ${d.expected}: ${Math.abs(d.colli - d.expected)} ${d.colli < d.expected ? "fewer" : "more"}`)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!list && diff !== null && (
          <p className={`alert ${diff === 0 ? "alert-success" : "alert-warn"} w-full`}>
            {diff === 0
              ? t(`Matches the expected ${result.expected}`)
              : t(`Expected ${result.expected}: ${Math.abs(diff)} ${diff < 0 ? "fewer" : "more"}`)}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setNotice(null);
          }}
          className="btn btn-primary w-full py-3"
        >
          {t("Count the next shipment")}
        </button>
      </section>
    );
  }

  const noModeChoice = state.count > 0 || (multi && state.groups.length > 0);

  const confirmText = (c: Exclude<Confirm, null>) => {
    if (c.kind === "undo") return t("Remove the last package?");
    if (c.kind === "cancel") return t("Cancel this count? All scanned packages are discarded.");
    if (c.kind === "remove") return t("Remove this delivery and all its scanned packages?");
    if (c.kind === "merge") return t(`Join delivery ${numberOf(state, c.from)} into delivery ${numberOf(state, c.into)}?`);
    return multi
      ? t(`Finish and save ${state.groups.length} deliveries (${state.groups.map((g) => g.count).join(" + ")} packages)?`)
      : t(`Finish with ${state.count} colli?`);
  };
  const confirmYes = (c: Exclude<Confirm, null>) =>
    c.kind === "undo" ? t("Yes, remove") : c.kind === "cancel" ? t("Yes, cancel") : c.kind === "remove" ? t("Yes, remove") : c.kind === "merge" ? t("Yes, join") : t("Yes, finish");

  // A plain function, not a component: a component defined here would be rebuilt on every update and lose its state.
  const renderGroup = (g: GroupState) => (
    <section key={g.id} className={`card flex flex-col gap-3 p-4 ${g.id === lastGroup ? "border-accent/60" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          {t("Delivery")} {g.number}
          {g.id === lastGroup && <span className="badge ml-2 bg-accent-soft text-accent">{t("Last scan")}</span>}
        </h3>
        <span className={`font-mono text-4xl font-bold leading-none ${g.expected !== null && g.count === g.expected ? "text-success" : "text-accent"}`}>{g.count}</span>
      </div>

      <div className="rounded-lg border border-line bg-page/60 p-3 text-sm">
        {g.reference && !g.rule && <p className="text-muted">{t("Scan one more package of this delivery. The shipment part of the code is worked out from it.")}</p>}
        {g.reference && g.rule && (
          <div className="flex flex-col gap-2">
            <p className="break-all font-mono text-base tracking-wide">
              <span className="font-semibold text-accent">{g.reference.slice(0, g.rule.prefix)}</span>
              <span className="text-muted">{g.reference.slice(g.rule.prefix)}</span>
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {t(`Matching: first ${g.rule.prefix} of ${g.rule.len} characters`)}
                {g.source && <> · {t(SOURCE[g.source])}</>}
              </span>
              <span className="flex gap-1.5">
                <button type="button" disabled={locked || g.rule.prefix <= 1} onClick={() => startBusy(async () => setState(await adjustGroup(g.id, -1)))} aria-label={t("Match fewer characters")} className="btn btn-secondary btn-sm min-w-10">−</button>
                <button type="button" disabled={locked || g.rule.prefix >= g.rule.len - 1} onClick={() => startBusy(async () => setState(await adjustGroup(g.id, 1)))} aria-label={t("Match more characters")} className="btn btn-secondary btn-sm min-w-10">+</button>
              </span>
            </div>
          </div>
        )}
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">{t("Expected colli (optional)")}</span>
        <input
          key={g.expected ?? "none"}
          defaultValue={g.expected ?? ""}
          onBlur={(e) => saveGroupExpected(g.id, e.target.value)}
          inputMode="numeric"
          maxLength={4}
          disabled={locked}
          className="input w-24 text-center"
        />
      </label>

      {state.noteCompare && !pending && <NoteCompare key={g.id} disabled={locked} group={g.id} />}

      <div className="flex flex-wrap items-center gap-2">
        {state.groups.length > 1 && (
          <>
            <select
              aria-label={t("Join into")}
              disabled={locked}
              value={mergeInto[g.id] ?? ""}
              onChange={(e) => setMergeInto((m) => ({ ...m, [g.id]: Number(e.target.value) }))}
              className="input w-auto py-1.5 text-sm"
            >
              <option value="">{t("Join into…")}</option>
              {state.groups.filter((o) => o.id !== g.id).map((o) => <option key={o.id} value={o.id}>{t("Delivery")} {o.number}</option>)}
            </select>
            <button type="button" disabled={locked || !mergeInto[g.id]} onClick={() => setConfirm({ kind: "merge", from: g.id, into: mergeInto[g.id] })} className="btn btn-secondary btn-sm">{t("Join")}</button>
          </>
        )}
        <button type="button" disabled={locked} onClick={() => setConfirm({ kind: "remove", group: g.id })} className="btn btn-danger-ghost btn-sm ml-auto">{t("Remove delivery")}</button>
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      {!noModeChoice ? (
        <section className="card flex flex-col gap-2 p-4">
          <p className="text-sm font-medium">{t("What are you counting?")}</p>
          <div className="grid grid-cols-2 gap-2" role="group">
            <button type="button" disabled={busy} onClick={() => multi && chooseMode(false)} aria-pressed={!multi} className={`btn btn-sm ${!multi ? "btn-primary" : "btn-secondary"}`}>{t("One delivery")}</button>
            <button type="button" disabled={busy} onClick={() => !multi && chooseMode(true)} aria-pressed={multi} className={`btn btn-sm ${multi ? "btn-primary" : "btn-secondary"}`}>{t("Several deliveries")}</button>
          </div>
          {multi && <p className="text-xs text-muted">{t("Scan the packages in any order. Each one joins the delivery it belongs to, or starts a new one.")}</p>}
        </section>
      ) : (
        multi && state.groups.length <= 1 && (
          <button type="button" disabled={locked} onClick={() => chooseMode(false)} className="self-start text-sm font-medium text-accent hover:underline">{t("Back to one delivery")}</button>
        )
      )}

      <section className="card flex flex-col items-center gap-1 p-4 text-center sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{t("colli counted")}</p>
        <p
          className={`font-mono text-[clamp(3rem,22vw,6rem)] font-bold leading-none ${
            !multi && state.expected !== null && state.count === state.expected ? "text-success" : "text-accent"
          }`}
        >
          {state.count}
        </p>
        {multi && state.groups.length > 0 && <p className="text-sm text-muted">{state.groups.length === 1 ? t("1 delivery") : t(`${state.groups.length} deliveries`)}</p>}
        {!multi && state.expected !== null && <p className="text-sm text-muted">{t(`of ${state.expected} expected`)}</p>}
        {notice && <p className="alert alert-success mt-2 w-full text-sm">{t(notice)}</p>}
      </section>

      <section className="card flex flex-col gap-3 p-4 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            scan(input.current?.value ?? "");
          }}
          className="flex flex-col gap-3"
        >
          <ScanInput
            id="package"
            name="package"
            label="Package code"
            placeholder="Scan the package"
            inputRef={input}
            resetKey={resetKey}
            alphanumeric
            maxLength={64}
            disabled={locked}
          />
          <button disabled={locked} className="btn btn-primary py-3">{t("Count package")}</button>
        </form>
        {error && <p role="alert" className="alert alert-error">{t(error)}</p>}

        {!multi && (
          <>
            <div className="rounded-lg border border-line bg-page/60 p-3 text-sm">
              {!ref && <p className="text-muted">{t("Scan the first package of the shipment.")}</p>}
              {ref && !rule && <p className="text-muted">{t("Scan the second package. The shipment part of the code is worked out from it.")}</p>}
              {ref && rule && (
                <div className="flex flex-col gap-2">
                  <p className="break-all font-mono text-base tracking-wide">
                    <span className="font-semibold text-accent">{ref.slice(0, rule.prefix)}</span>
                    <span className="text-muted">{ref.slice(rule.prefix)}</span>
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {t(`Matching: first ${rule.prefix} of ${rule.len} characters`)}
                      {state.source && <> · {t(SOURCE[state.source])}</>}
                    </span>
                    <span className="flex gap-1.5">
                      <button type="button" disabled={locked || rule.prefix <= 1} onClick={() => startBusy(async () => setState(await adjustMatch(-1)))} aria-label={t("Match fewer characters")} className="btn btn-secondary btn-sm min-w-10">−</button>
                      <button type="button" disabled={locked || rule.prefix >= rule.len - 1} onClick={() => startBusy(async () => setState(await adjustMatch(1)))} aria-label={t("Match more characters")} className="btn btn-secondary btn-sm min-w-10">+</button>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">{t("Expected colli (optional)")}</span>
              <input
                key={state.expected ?? "none"}
                defaultValue={state.expected ?? ""}
                onBlur={(e) => saveExpected(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                disabled={locked}
                className="input w-24 text-center"
              />
            </label>
          </>
        )}
      </section>

      {multi && state.groups.map((g) => renderGroup(g))}

      {feed.length > 0 && (
        <section className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {feed.map((e, i) => (
              <li key={`${e.code}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 break-all font-mono text-sm">{e.code}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {multi && e.delivery && <span className="text-xs text-muted">{t("Delivery")} {e.delivery}</span>}
                  <span className={`badge ${BADGE[e.kind]}`}>{t(LABEL[e.kind])}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!multi && state.noteCompare && state.count > 0 && !pending && <NoteCompare disabled={locked} />}
      {multi && state.noteCompare && state.groups.length > 1 && !pending && <NoteCompare key="all" disabled={locked} group="all" />}

      <section className="card flex flex-col gap-3 p-4">
        {confirm ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{confirmText(confirm)}</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => run(confirm)} className={`btn btn-sm ${confirm.kind === "finish" || confirm.kind === "merge" ? "btn-primary" : "btn-danger"}`}>
                {confirmYes(confirm)}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="btn btn-secondary btn-sm">{t("No, keep counting")}</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={locked || state.count === 0} onClick={() => setConfirm({ kind: "undo" })} className="btn btn-secondary btn-sm">{t("Remove last")}</button>
            <button type="button" disabled={locked || !state.active} onClick={() => setConfirm({ kind: "cancel" })} className="btn btn-danger-ghost btn-sm">{t("Cancel count")}</button>
            <button type="button" disabled={locked || state.count === 0} onClick={() => setConfirm({ kind: "finish" })} className="btn btn-primary btn-sm">{t("Finish")}</button>
          </div>
        )}
      </section>

      {pending && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="mismatch-title" className="card flex w-full max-w-md flex-col gap-3 border-danger/60 p-5">
            <h2 id="mismatch-title" className="text-lg font-semibold text-danger">{t("This package does not belong to this shipment")}</h2>
            <p className="break-all rounded-md bg-page px-3 py-2 font-mono text-base">{pending}</p>
            <button type="button" disabled={busy} onClick={() => decide("ignore")} className="btn btn-primary py-3">{t("Ignore this scan")}</button>
            <button type="button" disabled={busy} onClick={() => decide("count")} className="btn btn-secondary py-3">{t("Count it anyway")}</button>
            {state.count > 0 && (
              <>
                <button type="button" disabled={busy} onClick={() => decide("delivery")} className="btn btn-secondary py-3">{t("Count as another delivery")}</button>
                <button type="button" disabled={busy} onClick={() => decide("new")} className="btn btn-secondary py-3">{t("Save this shipment and start a new one")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
