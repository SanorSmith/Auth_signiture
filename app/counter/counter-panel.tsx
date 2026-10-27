"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { adjustMatch, cancelCount, finishCount, resolveScan, scanPackage, setExpected, undoScan } from "@/lib/counter-actions";
import type { CounterState, Finished } from "@/lib/counter";
import { signal } from "@/lib/tones";
import { useT } from "../lang-provider";
import { ScanInput } from "../scan-input";
import { NoteCompare } from "./note-compare";

const EMPTY: CounterState = { active: false, count: 0, reference: null, rule: null, expected: null, source: null, noteCompare: false, recent: [] };

type Kind = "counted" | "duplicate" | "forced" | "ignored";
type Entry = { code: string; kind: Kind };
type Confirm = "undo" | "cancel" | "finish" | null;

const BADGE: Record<Kind, string> = {
  counted: "bg-success-soft text-success",
  duplicate: "bg-warn-soft text-warn",
  forced: "bg-warn-soft text-warn",
  ignored: "border border-line bg-page text-muted",
};
const SOURCE = { memory: "From earlier counts", scans: "Learned from these scans", adjusted: "Adjusted by you" } as const;
const LABEL: Record<Kind, string> = {
  counted: "Counted",
  duplicate: "Already counted",
  forced: "Counted anyway",
  ignored: "Ignored",
};

// The counting screen. Scan each package of one shipment: the app learns from the first two which
// part of the code identifies the shipment, counts the packages that fit, and warns (with a sound)
// about a package scanned twice or one that belongs to another shipment.
export function CounterPanel({ initial }: { initial: CounterState }) {
  const t = useT();
  const [state, setState] = useState(initial);
  const [feed, setFeed] = useState<Entry[]>([]);
  const [pending, setPending] = useState<string | null>(null); // a package that does not fit, waiting for a decision
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, startBusy] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const locked = pending !== null || confirm !== null || result !== null || busy;
  const remember = useCallback((code: string, kind: Kind) => setFeed((f) => [{ code, kind }, ...f].slice(0, 8)), []);

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
      if (res.outcome === "invalid") {
        setError("Not a valid package code");
        void signal("error");
      } else if (res.outcome === "counted") {
        remember(res.code!, "counted");
        void signal("counted");
      } else if (res.outcome === "duplicate") {
        remember(res.code!, "duplicate");
        void signal("duplicate");
      } else {
        setPending(res.code);
      }
      setResetKey((k) => k + 1);
    });
  };

  const decide = (choice: "ignore" | "count" | "new") => {
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
      } else {
        setFeed([{ code, kind: "counted" }]);
        setNotice(res.finished ? `Previous shipment saved: ${res.finished.colli} colli` : null);
        void signal("finished");
      }
      setResetKey((k) => k + 1);
    });
  };

  const run = (kind: Exclude<Confirm, null>) =>
    startBusy(async () => {
      setConfirm(null);
      setError(null);
      if (kind === "undo") {
        const next = await undoScan();
        setState(next);
        setFeed((f) => {
          const i = f.findIndex((x) => x.kind === "counted" || x.kind === "forced");
          return i < 0 ? f : f.filter((_, j) => j !== i);
        });
        void signal("deleted");
      } else if (kind === "cancel") {
        setState(await cancelCount());
        setFeed([]);
        void signal("deleted");
      } else {
        const res = await finishCount();
        if ("error" in res) {
          setError(res.error);
          void signal("error");
        } else {
          setResult({ colli: res.colli, expected: res.expected });
          setState(EMPTY);
          setFeed([]);
          void signal("finished");
        }
      }
      setResetKey((k) => k + 1);
    });

  const saveExpected = (value: string) => {
    const n = value.trim() === "" ? null : Number(value);
    startBusy(async () => setState(await setExpected(n !== null && Number.isFinite(n) ? n : null)));
  };

  const rule = state.rule;
  const ref = state.reference;

  if (result) {
    const diff = result.expected === null ? null : result.colli - result.expected;
    return (
      <section className="card flex flex-col items-center gap-3 p-6 text-center" role="status">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{t("Shipment counted")}</p>
        <p className="font-mono text-[clamp(3rem,22vw,7rem)] font-bold leading-none text-success">{result.colli}</p>
        <p className="text-lg font-medium">{t("colli received")}</p>
        {diff !== null && (
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

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      <section className="card flex flex-col items-center gap-1 p-4 text-center sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{t("colli counted")}</p>
        <p
          className={`font-mono text-[clamp(3rem,22vw,6rem)] font-bold leading-none ${
            state.expected !== null && state.count === state.expected ? "text-success" : "text-accent"
          }`}
        >
          {state.count}
        </p>
        {state.expected !== null && <p className="text-sm text-muted">{t(`of ${state.expected} expected`)}</p>}
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
                  <button
                    type="button"
                    disabled={locked || rule.prefix <= 1}
                    onClick={() => startBusy(async () => setState(await adjustMatch(-1)))}
                    aria-label={t("Match fewer characters")}
                    className="btn btn-secondary btn-sm min-w-10"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={locked || rule.prefix >= rule.len - 1}
                    onClick={() => startBusy(async () => setState(await adjustMatch(1)))}
                    aria-label={t("Match more characters")}
                    className="btn btn-secondary btn-sm min-w-10"
                  >
                    +
                  </button>
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
      </section>

      {feed.length > 0 && (
        <section className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {feed.map((e, i) => (
              <li key={`${e.code}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 break-all font-mono text-sm">{e.code}</span>
                <span className={`badge shrink-0 ${BADGE[e.kind]}`}>{t(LABEL[e.kind])}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.noteCompare && state.count > 0 && !pending && <NoteCompare disabled={locked} />}

      <section className="card flex flex-col gap-3 p-4">
        {confirm ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {confirm === "undo" && t("Remove the last package?")}
              {confirm === "cancel" && t("Cancel this count? All scanned packages are discarded.")}
              {confirm === "finish" && t(`Finish with ${state.count} colli?`)}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => run(confirm)} className={`btn btn-sm ${confirm === "finish" ? "btn-primary" : "btn-danger"}`}>
                {confirm === "undo" && t("Yes, remove")}
                {confirm === "cancel" && t("Yes, cancel")}
                {confirm === "finish" && t("Yes, finish")}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="btn btn-secondary btn-sm">{t("No, keep counting")}</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={locked || state.count === 0} onClick={() => setConfirm("undo")} className="btn btn-secondary btn-sm">{t("Remove last")}</button>
            <button type="button" disabled={locked || !state.active} onClick={() => setConfirm("cancel")} className="btn btn-danger-ghost btn-sm">{t("Cancel count")}</button>
            <button type="button" disabled={locked || state.count === 0} onClick={() => setConfirm("finish")} className="btn btn-primary btn-sm">{t("Finish")}</button>
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
              <button type="button" disabled={busy} onClick={() => decide("new")} className="btn btn-secondary py-3">{t("Save this shipment and start a new one")}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
