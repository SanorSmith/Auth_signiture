"use client";

import { useEffect, useRef, useState } from "react";
import { signal } from "@/lib/tones";
import { duplicateItems, mergeDuplicates, quantity, type NoteRow, type NoteTable } from "@/lib/note-table";
import { shrink } from "../counter/note-compare";
import { useT } from "../lang-provider";

const MAX_PAGES = 10;
const AT_ONCE = 2; // photos read at the same time

type Row = NoteRow & { id: number; page: number };
type Page = { id: number; name: string; status: "reading" | "done" | "error"; error?: string; count: number };

async function readPage(image: string): Promise<{ ok: true; data: NoteTable } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/mobile/notes/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, mediaType: "image/jpeg" }) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: data as NoteTable } : { ok: false, error: (data as { error?: string }).error ?? "Could not read the delivery note. Try again." };
  } catch {
    return { ok: false, error: "Could not read the delivery note. Try again." };
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // An older browser, or a page that is not secure: select and copy from a hidden box.
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

// Photograph the pages of a delivery note; the AI reads each page, and the lines of all pages become one table
// to copy: the item numbers alone, the delivered quantities alone, or the whole table. Nothing is stored: the
// photos and the table live only in this component and are gone when the person leaves the page.
export function NoteTablePanel() {
  const t = useT();
  const [pages, setPages] = useState<Page[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const files = useRef(new Map<number, File>());
  const queue = useRef<number[]>([]);
  const running = useRef(0);
  const nextPage = useRef(1);
  const nextRow = useRef(1);
  const pick = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const map = files.current;
    return () => map.clear();
  }, []);

  const patch = (id: number, p: Partial<Page>) => setPages((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // The rows of a page go where that page belongs, whatever order the pages finish reading in.
  const place = (page: number, list: NoteRow[]) =>
    setRows((all) => [
      ...all.filter((r) => r.page < page),
      ...list.map((r) => ({ item: r.item, delivered: r.delivered, description: "", id: nextRow.current++, page })),
      ...all.filter((r) => r.page > page),
    ]);

  const pump = () => {
    while (running.current < AT_ONCE && queue.current.length) {
      const id = queue.current.shift() as number;
      const file = files.current.get(id);
      if (!file) continue;
      running.current++;
      patch(id, { status: "reading", error: undefined });
      void (async () => {
        try {
          const image = await shrink(file);
          const res = await readPage(image);
          if (!res.ok) {
            patch(id, { status: "error", error: res.error });
            void signal("error");
          } else if (!res.data.legible || res.data.rows.length === 0) {
            place(id, []);
            patch(id, { status: "error", error: "No table could be read from this photo. Take a clearer, straight-on photo of the note.", count: 0 });
            void signal("error");
          } else {
            place(id, res.data.rows);
            patch(id, { status: "done", count: res.data.rows.length });
          }
        } catch {
          patch(id, { status: "error", error: "Could not read the delivery note. Try again." });
        } finally {
          running.current--;
          if (!queue.current.length && running.current === 0) void signal("finished");
          pump();
        }
      })();
    }
  };

  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const room = MAX_PAGES - pages.length;
    const take = Array.from(list).slice(0, Math.max(0, room));
    setNote(list.length > take.length ? `${t("You can add at most 10 pages.")}` : null);
    const added: Page[] = take.map((f) => {
      const id = nextPage.current++;
      files.current.set(id, f);
      queue.current.push(id);
      return { id, name: f.name, status: "reading", count: 0 };
    });
    setPages((all) => [...all, ...added]);
    pump();
  };

  const retry = (id: number) => {
    queue.current.push(id);
    patch(id, { status: "reading", error: undefined });
    pump();
  };

  const removePage = (id: number) => {
    files.current.delete(id);
    queue.current = queue.current.filter((x) => x !== id);
    setPages((all) => all.filter((p) => p.id !== id));
    setRows((all) => all.filter((r) => r.page !== id));
  };

  const clearAll = () => {
    files.current.clear();
    queue.current = [];
    setPages([]);
    setRows([]);
    setNote(null);
  };

  const edit = (id: number, field: keyof NoteRow, value: string) => setRows((all) => all.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const removeRow = (id: number) => setRows((all) => all.filter((r) => r.id !== id));
  const addRow = () => setRows((all) => [...all, { id: nextRow.current++, page: all.at(-1)?.page ?? 0, item: "", delivered: "", description: "" }]);
  const merge = () => {
    const merged = mergeDuplicates(rows);
    setRows(merged.map((r) => ({ ...r, description: "", id: nextRow.current++, page: 0 })));
  };

  const copy = async (what: string, text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      void signal("done");
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    }
  };

  const dups = duplicateItems(rows);
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const odd = rows.filter((r) => r.delivered.trim() !== "" && quantity(r.delivered) === null).length;
  const total = rows.reduce((n, r) => n + (quantity(r.delivered) ?? 0), 0);
  const busy = pages.some((p) => p.status === "reading");
  const column = (pick: (r: Row) => string) => rows.map(pick).join("\n");

  const Copy = ({ what, text }: { what: string; text: string }) => (
    <button type="button" onClick={() => copy(what, text)} disabled={rows.length === 0} className="btn btn-secondary btn-sm">
      {copied === what ? t("Copied") : t("Copy")}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => pick.current?.click()} disabled={pages.length >= MAX_PAGES} className="btn btn-primary">{t("Choose photos")}</button>
          <button type="button" onClick={() => camera.current?.click()} disabled={pages.length >= MAX_PAGES} className="btn btn-secondary">{t("Take photo")}</button>
          {pages.length > 0 && <button type="button" onClick={clearAll} className="btn btn-danger-ghost ml-auto">{t("Clear all")}</button>}
        </div>
        <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <p className="text-xs text-muted">{t("Choose all the pages of the note at once. Each page is read, and the lines are joined into one table in page order.")}</p>
        {note && <p role="alert" className="text-sm text-warn">{note}</p>}

        {pages.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {pages.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{t("Page")} {i + 1}</span> <span className="text-muted">· {p.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  {p.status === "reading" && <span className="text-muted">{t("Reading…")}</span>}
                  {p.status === "done" && <span className="badge bg-success-soft text-success">{p.count} {t("lines")}</span>}
                  {p.status === "error" && (
                    <>
                      <span role="alert" className="max-w-64 text-xs text-danger">{t(p.error ?? "")}</span>
                      <button type="button" onClick={() => retry(p.id)} className="btn btn-secondary btn-sm">{t("Read again")}</button>
                    </>
                  )}
                  <button type="button" onClick={() => removePage(p.id)} disabled={p.status === "reading"} className="btn btn-danger-ghost btn-sm">{t("Remove")}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length > 0 && (
        <section className="card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-semibold">{rows.length}</span> {t("lines")} · {t("Total delivered")}: <span className="font-semibold tabular-nums">{Math.round(total * 100) / 100}</span>
            </p>
            <Copy what="table" text={rows.map((r) => `${r.item}\t${r.delivered}`).join("\n")} />
          </div>

          {dups.size > 0 && (
            <p className="alert alert-warn flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{t("The same item number appears on more than one line.")}</span>
              <button type="button" onClick={merge} className="btn btn-secondary btn-sm">{t("Merge duplicate items")}</button>
            </p>
          )}
          {odd > 0 && <p className="alert alert-warn text-sm">{odd} {t("lines have a delivered quantity that is not a number. Check them.")}</p>}

          <div className="overflow-x-auto">
            <div className="min-w-[20rem]">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2 pb-2 text-xs font-medium text-muted">
                <span className="flex items-center justify-between gap-1">{t("Item number")} <Copy what="item" text={column((r) => r.item)} /></span>
                <span className="flex items-center justify-between gap-1">{t("Delivered")} <Copy what="delivered" text={column((r) => r.delivered)} /></span>
                <span />
              </div>
              <div className="flex flex-col gap-1.5">
                {rows.map((r) => {
                  const dup = dups.has(norm(r.item));
                  const bad = r.delivered.trim() !== "" && quantity(r.delivered) === null;
                  return (
                    <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2">
                      <input value={r.item} onChange={(e) => edit(r.id, "item", e.target.value)} aria-label={t("Item number")} className={`input py-1.5 font-mono text-sm ${dup ? "border-warn bg-warn-soft" : ""}`} />
                      <input value={r.delivered} onChange={(e) => edit(r.id, "delivered", e.target.value)} aria-label={t("Delivered")} inputMode="decimal" className={`input py-1.5 text-right font-mono text-sm tabular-nums ${bad ? "border-danger text-danger" : ""}`} />
                      <button type="button" onClick={() => removeRow(r.id)} aria-label={t("Remove line")} className="btn btn-danger-ghost btn-sm px-0">×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <button type="button" onClick={addRow} className="btn btn-secondary btn-sm">{t("Add line")}</button>
          </div>
        </section>
      )}

      {pages.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{t("No delivery note read yet. Choose photos or take one to start.")}</p>
      )}
      {busy && <p className="text-center text-sm text-muted" role="status">{t("Reading the delivery note…")}</p>}
      <p className="text-xs text-muted">{t("Nothing is saved: the photos and the table are gone when you leave this page.")}</p>
    </div>
  );
}
