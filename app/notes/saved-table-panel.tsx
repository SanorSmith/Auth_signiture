"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signal } from "@/lib/tones";
import { quantity, type NoteRow } from "@/lib/note-table";
import { useT } from "../lang-provider";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  }
}

// The table saved from the phone ("On this phone" reader): it stays until it is cleared, so it can be opened here
// while the next pages are still being added on the phone. The page checks for changes every few seconds.
export function SavedTablePanel() {
  const t = useT();
  const [rows, setRows] = useState<NoteRow[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false); // while this screen is changing the table, a refresh must not undo the change

  const load = useCallback(async () => {
    if (busy.current) return;
    try {
      const res = await fetch("/api/mobile/notes/saved", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { rows: NoteRow[] };
      if (!busy.current) setRows(data.rows);
    } catch {
      // Offline for a moment: keep what is shown.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 6000);
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  const save = async (next: NoteRow[]) => {
    busy.current = true;
    setError(null);
    setRows(next);
    try {
      const res = await fetch("/api/mobile/notes/saved", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: next }) });
      if (!res.ok) setError("Could not save the change. Try again.");
    } catch {
      setError("Could not save the change. Try again.");
    } finally {
      busy.current = false;
    }
  };

  const copy = async (what: string, text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      void signal("done");
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    }
  };

  const list = rows ?? [];
  const total = list.reduce((n, r) => n + (quantity(r.delivered) ?? 0), 0);
  const column = (pick: (r: NoteRow) => string) => list.map(pick).join("\n");
  const Copy = ({ what, text }: { what: string; text: string }) => (
    <button type="button" onClick={() => copy(what, text)} disabled={list.length === 0} className="btn btn-secondary btn-sm">
      {copied === what ? t("Copied") : t("Copy")}
    </button>
  );

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t("Saved from the phone")}</h2>
          <p className="text-xs text-muted">{t("The table built with On this phone in the app. It stays here until you remove it.")}</p>
        </div>
        {list.length > 0 && (
          <div className="flex items-center gap-2">
            <Copy what="table" text={list.map((r) => `${r.item}\t${r.delivered}\t${r.description}`).join("\n")} />
            {confirming ? (
              <>
                <button type="button" onClick={() => { setConfirming(false); void save([]); }} className="btn btn-danger btn-sm">{t("Yes, remove")}</button>
                <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">{t("Cancel")}</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm">{t("Remove the table")}</button>
            )}
          </div>
        )}
      </div>
      {error && <p role="alert" className="alert alert-danger text-sm">{t(error)}</p>}

      {rows === null ? (
        <p className="text-sm text-muted" role="status">{t("Loading…")}</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">{t("Nothing saved. Read a delivery note with On this phone in the app and it appears here.")}</p>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-semibold">{list.length}</span> {t("lines")} · {t("Total delivered")}: <span className="font-semibold tabular-nums">{Math.round(total * 100) / 100}</span>
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[34rem]">
              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.6fr)_2rem] items-center gap-2 pb-2 text-xs font-medium text-muted">
                <span className="flex items-center justify-between gap-1">{t("Item number")} <Copy what="item" text={column((r) => r.item)} /></span>
                <span className="flex items-center justify-between gap-1">{t("Delivered")} <Copy what="delivered" text={column((r) => r.delivered)} /></span>
                <span className="flex items-center justify-between gap-1">{t("Description")} <Copy what="description" text={column((r) => r.description)} /></span>
                <span />
              </div>
              <div className="flex flex-col">
                {list.map((r, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.6fr)_2rem] items-center gap-2 border-t border-line py-1.5 text-sm">
                    <span className="break-all font-mono">{r.item || "–"}</span>
                    <span className="text-right font-mono tabular-nums">{r.delivered || "–"}</span>
                    <span className="min-w-0 truncate" title={r.description}>{r.description}</span>
                    <button type="button" onClick={() => void save(list.filter((_, n) => n !== i))} aria-label={t("Remove line")} className="btn btn-danger-ghost btn-sm px-0">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
