"use client";

import { useEffect, useRef, useState } from "react";
import { signal } from "@/lib/tones";
import type { Comparison } from "@/lib/counter-note";
import { useT } from "../lang-provider";

type Stage = "idle" | "reading" | "review" | "comparing" | "result";
type Reading = { legible: boolean; ids: string[]; total: number | null; supplier: string | null; comment: string | null };

const ENDPOINT = "/api/mobile/counter";
const MAX_PAGES = 10;
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// A photo is shrunk before it is sent, but kept large enough that small print and handwriting stay readable.
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/jpeg", 0.85));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function post<T>(action: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${ENDPOINT}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: data as T } : { ok: false, error: (data as { error?: string }).error ?? "Could not read the delivery note. Try again." };
  } catch {
    return { ok: false, error: "Could not read the delivery note. Try again." };
  }
}

// Compare the scanned packages with the IDs printed on the delivery note. The list the AI reads is
// only kept in this component: it is cleared when the person closes it, and when the count ends.
export function NoteCompare({ disabled }: { disabled: boolean }) {
  const t = useT();
  const [stage, setStage] = useState<Stage>("idle");
  const [reading, setReading] = useState<Reading | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [added, setAdded] = useState<number | null>(null); // new IDs found on the page just added
  const adding = useRef(false);
  const file = useRef<HTMLInputElement>(null);

  // Leaving the screen (or finishing the count) removes everything that was read.
  useEffect(
    () => () => {
      setReading(null);
      setText("");
      setResult(null);
    },
    [],
  );

  const close = () => {
    setStage("idle");
    setReading(null);
    setText("");
    setResult(null);
    setError(null);
    setPages(0);
    setAdded(null);
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    // A page added to what was already read keeps the list; a first photo starts a new one.
    const more = adding.current;
    adding.current = false;
    const back = more ? "review" : "idle";
    setError(null);
    setWhy(null);
    setStage("reading");
    try {
      const image = await shrink(f);
      const res = await post<Reading>("note-read", { image, mediaType: "image/jpeg" });
      if (!res.ok) {
        setError(res.error);
        setStage(back);
        void signal("error");
        return;
      }
      if (!res.data.legible || res.data.ids.length === 0) {
        setError("No package IDs could be read from this photo. Take a clearer, straight-on photo of the note.");
        setWhy(res.data.comment);
        setStage(back);
        void signal("error");
        return;
      }
      if (more) {
        const have = text.split(/[\s,;]+/).filter(Boolean);
        const known = new Set(have.map(norm));
        const fresh = res.data.ids.filter((id) => !known.has(norm(id)));
        setText([...have, ...fresh].join("\n"));
        setPages((n) => n + 1);
        setAdded(fresh.length);
        // Totals on separate pages are often subtotals, so the note's total is not used for several pages.
        setReading((r) => (r ? { ...r, total: null } : res.data));
      } else {
        setReading(res.data);
        setText(res.data.ids.join("\n"));
        setPages(1);
        setAdded(null);
      }
      setStage("review");
    } catch {
      setError("Could not read the delivery note. Try again.");
      setStage(back);
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  const compare = async () => {
    setError(null);
    setStage("comparing");
    const ids = text.split(/[\s,;]+/).filter(Boolean);
    const res = await post<Comparison>("note-compare", { ids });
    if (!res.ok) {
      setError(res.error);
      setStage("review");
      void signal("error");
      return;
    }
    setResult(res.data);
    setStage("result");
    const clean = !res.data.missing.length && !res.data.extra.length && !res.data.possible.length;
    void signal(clean ? "finished" : "mismatch");
  };

  const List = ({ title, items, tone }: { title: string; items: string[]; tone: string }) =>
    items.length === 0 ? null : (
      <div>
        <p className={`mb-1 text-sm font-semibold ${tone}`}>{t(title)} ({items.length})</p>
        <ul className="rounded-md bg-page p-2 font-mono text-sm">
          {items.map((c) => <li key={c} className="break-all py-0.5">{c}</li>)}
        </ul>
      </div>
    );

  const picker = <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />;

  if (stage === "idle") {
    return (
      <section className="card flex flex-col gap-2 p-4">
        {picker}
        <button type="button" disabled={disabled} onClick={() => file.current?.click()} className="btn btn-secondary">
          {t("Compare with delivery note")}
        </button>
        {error && <p role="alert" className="alert alert-error text-sm">{t(error)}{why && <><br /><span className="opacity-80">{t("The reader saw")}: {why}</span></>}</p>}
      </section>
    );
  }

  if (stage === "reading" || stage === "comparing") {
    return (
      <section className="card flex items-center justify-center gap-3 p-6" role="status">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        <span className="font-medium">{stage === "reading" ? t("Reading the delivery note…") : t("Comparing…")}</span>
      </section>
    );
  }

  if (stage === "review" && reading) {
    return (
      <section className="card flex flex-col gap-3 p-4">
        {picker}
        <h2 className="font-semibold">{t("Package IDs read from the note")}</h2>
        <p className="text-sm text-muted">
          {t("Check the numbers against the paper and fix any mistake. One ID per line.")}
          {reading.total !== null && <> {t(`The note says ${reading.total} colli.`)}</>}
          {reading.supplier && <> {reading.supplier}.</>}
        </p>
        {pages > 1 && added !== null && <p className="text-sm font-medium text-accent">{t(`${pages} pages read. ${added} new IDs from the last page.`)}</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(14, Math.max(5, text.split("\n").length + 1))}
          spellCheck={false}
          autoCapitalize="characters"
          className="input font-mono text-sm"
        />
        {error && <p role="alert" className="alert alert-error text-sm">{t(error)}{why && <><br /><span className="opacity-80">{t("The reader saw")}: {why}</span></>}</p>}
        <button
          type="button"
          disabled={pages >= MAX_PAGES}
          onClick={() => {
            adding.current = true;
            file.current?.click();
          }}
          className="btn btn-secondary btn-sm self-start"
        >
          {t("Add another page")}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => void compare()} className="btn btn-primary">{t("Compare")}</button>
          <button type="button" onClick={close} className="btn btn-secondary">{t("Cancel")}</button>
        </div>
      </section>
    );
  }

  if (stage === "result" && result) {
    const clean = !result.missing.length && !result.extra.length && !result.possible.length;
    const noteTotal = reading?.total ?? null;
    return (
      <section className={`card flex flex-col gap-3 p-4 ${clean ? "border-success/50" : "border-danger/50"}`} role="alert">
        <h2 className={`text-lg font-semibold ${clean ? "text-success" : "text-danger"}`}>
          {clean ? t("Everything on the note was scanned") : t("The scan and the note do not match")}
        </h2>
        <p className="text-sm text-muted">{t(`${result.matched.length} of ${result.noteCount} on the note were scanned.`)}</p>
        {noteTotal !== null && noteTotal !== result.scannedCount && (
          <p className="alert alert-warn text-sm">{t(`The note says ${noteTotal} colli, you counted ${result.scannedCount}.`)}</p>
        )}
        <List title="Missing: on the note, not scanned" items={result.missing} tone="text-danger" />
        <List title="Extra: scanned, not on the note" items={result.extra} tone="text-warn" />
        {result.possible.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-warn">{t("Possible misread")} ({result.possible.length})</p>
            <ul className="rounded-md bg-page p-2 font-mono text-sm">
              {result.possible.map((p) => (
                <li key={p.note} className="break-all py-0.5">{t("Note")}: {p.note} · {t("Scanned")}: {p.scanned}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={close} className="btn btn-primary">{t("Close")}</button>
      </section>
    );
  }
  return null;
}
