"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Permission } from "@/lib/permissions";
import type { T } from "@/lib/i18n";
import { useT } from "./lang-provider";
import { getPushKey, markNotificationsRead, removePushSubscription, savePushSubscription } from "@/lib/push-actions";
import {
  ACTION_TONES,
  NOTIFICATION_TONES,
  audioState,
  isToneKind,
  playTone,
  setSoundEnabled,
  signal,
  soundEnabled,
  toneSeconds,
  unlockAudio,
  type ToneInfo,
  type ToneKind,
} from "@/lib/tones";

type Item = { id: number; kind: string; title: string; body: string; url: string; at: number; read: boolean };
type PushState = "checking" | "unsupported" | "off" | "on" | "blocked" | "busy";

const POLL_MS = 4000;

const DOT: Record<string, string> = {
  new_request: "bg-accent",
  reset_requested: "bg-warn",
  code_issued: "bg-success",
  request_denied: "bg-danger",
  request_removed: "bg-muted",
  access_changed: "bg-accent",
};

function ago(ms: number, t: T) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return t("just now");
  if (s < 3600) return t(`${Math.floor(s / 60)} min ago`);
  if (s < 86400) return t(`${Math.floor(s / 3600)} h ago`);
  return t(`${Math.floor(s / 86400)} d ago`);
}

function keyToBytes(b64: string) {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// The bell in the header, for everyone. It lists what other people did that concerns you, plays a
// different tone for each kind while the app is open, and (with device notifications on) alerts the
// phone even when the app is closed.
export function NotificationCenter({ perms }: { perms: Permission[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [sound, setSound] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [toast, setToast] = useState<Item | null>(null);
  const [push, setPush] = useState<PushState>("checking");
  const [pushError, setPushError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [promptHidden, setPromptHidden] = useState(true);

  const lastId = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSound(soundEnabled());
    setMounted(true);
    // Ask again about device notifications only once a week if someone says "Not now".
    try {
      const asked = Number(localStorage.getItem("push-prompt") ?? 0);
      setPromptHidden(Date.now() - asked < 7 * 24 * 3600 * 1000);
    } catch {
      setPromptHidden(false);
    }
  }, []);

  // Browsers keep sound locked until the person taps the page. Keep trying on every tap until it works
  // (a touch alone does not count in Chrome; the tap that follows it does).
  useEffect(() => {
    const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    const unlock = async () => {
      if (await unlockAudio()) {
        setBlocked(false);
        setLocked(false);
        for (const e of events) window.removeEventListener(e, unlock);
      }
    };
    for (const e of events) window.addEventListener(e, unlock);
    return () => {
      for (const e of events) window.removeEventListener(e, unlock);
    };
  }, []);

  // Say so when sound is locked, instead of staying silent without a word.
  useEffect(() => {
    const check = () => setLocked(sound && audioState() === "locked");
    check();
    const t = setInterval(check, 1500);
    return () => clearInterval(t);
  }, [sound]);

  const enableSound = async () => {
    const ok = await unlockAudio();
    setBlocked(!ok);
    setLocked(!ok);
    if (ok) await playTone("done");
  };

  const hidePrompt = () => {
    try {
      localStorage.setItem("push-prompt", String(Date.now()));
    } catch {}
    setPromptHidden(true);
  };

  const announce = useCallback(async (item: Item) => {
    const kind: ToneKind = isToneKind(item.kind) ? item.kind : "new_request";
    setBlocked(!(await signal(kind)));
    setToast(item);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 12000);
  }, []);

  // Ask the server every few seconds whether something new arrived for this person.
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const first = lastId.current === null;
        const res = await fetch(first ? "/api/notifications?list=1" : `/api/notifications?after=${lastId.current}`, { cache: "no-store" });
        if (res.status === 401) {
          stopped = true;
          return;
        }
        const data = (await res.json()) as { items: Item[]; unread: number; latestId: number };
        setUnread(data.unread);
        if (first) {
          // The first answer only fills the list: what is already there does not ring on page load.
          setItems(data.items);
          lastId.current = data.latestId;
          return;
        }
        if (data.items.length) {
          lastId.current = Math.max(lastId.current ?? 0, ...data.items.map((i) => i.id));
          setItems((prev) => [...[...data.items].reverse(), ...prev].slice(0, 15));
          void announce(data.items[data.items.length - 1]);
        }
      } catch {
        // Offline for a moment; the next poll tries again.
      }
    };
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(toastTimer.current);
    };
  }, [announce]);

  // Opening the bell counts as reading what is in it.
  useEffect(() => {
    if (!open || unread === 0) return;
    const t = setTimeout(async () => {
      await markNotificationsRead();
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }, 1500);
    return () => clearTimeout(t);
  }, [open, unread]);

  // Is this device already subscribed to device notifications?
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || process.env.NODE_ENV !== "production") {
      setPush("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPush("blocked");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPush(sub && Notification.permission === "granted" ? "on" : "off"))
      .catch(() => setPush("unsupported"));
  }, []);

  const enablePush = async () => {
    setPushError(null);
    setPush("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setPush(Notification.permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(await getPushKey()) }));
      const json = sub.toJSON();
      const saved = await savePushSubscription(
        { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        navigator.userAgent,
      );
      if ("error" in saved) throw new Error(saved.error);
      setPush("on");
    } catch (e) {
      setPush("off");
      setPushError(e instanceof Error ? e.message : "Could not turn on device notifications");
    }
  };

  const disablePush = async () => {
    setPush("busy");
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setPush("off");
    }
  };

  const preview = async (kind: ToneKind) => setBlocked(!(await playTone(kind)));
  const toggleSound = (on: boolean) => {
    setSound(on);
    setSoundEnabled(on);
  };

  // Only the tones that can reach this person (administrators hold every permission).
  const mine = (list: ToneInfo[]) => list.filter((x) => !x.needs || perms.includes(x.needs));

  const ToneRow = ({ tone }: { tone: ToneInfo }) => (
    <li className="flex items-center justify-between gap-2">
      <span className="min-w-0">
        <span className="block truncate text-sm">{t(tone.label)}</span>
        <span className="block truncate text-xs text-muted">{t(tone.hint)} · {toneSeconds(tone.kind).toFixed(1)} s</span>
      </span>
      <button type="button" onClick={() => preview(tone.kind)} className="btn btn-secondary btn-sm shrink-0">{t("Play")}</button>
    </li>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Notifications")}
        aria-expanded={open}
        className="btn btn-secondary btn-sm relative !px-2.5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
          {!sound && <path d="M4 4l16 16" />}
        </svg>
        {unread > 0 && (
          <span className="badge absolute -right-1.5 -top-1.5 min-w-5 justify-center bg-danger px-1 text-[10px] text-white">{unread}</span>
        )}
      </button>

      {open && (
        <div className="card fixed inset-x-3 top-14 z-20 flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("Notifications")}</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">{t("Close")}</button>
          </div>

          <ul className="flex flex-col gap-1">
            {items.length === 0 && <li className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">{t("Nothing yet. New activity shows up here.")}</li>}
            {(all ? items : items.slice(0, 5)).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.url}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-1 transition hover:bg-page"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.kind] ?? "bg-muted"} ${n.read ? "opacity-40" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                    <span className="block truncate text-xs text-muted">{n.body.length > 48 ? `${n.body.slice(0, 48)}…` : n.body} · {ago(n.at, t)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {items.length > 5 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="-mt-2 self-start text-xs text-accent">
              {all ? t("Show fewer") : t(`Show all ${items.length}`)}
            </button>
          )}

          <div className="border-t border-line pt-3">
            <div className="flex items-start justify-between gap-3">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => toggleSound(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-medium">{t("Play sounds")}</span>
                  <span className="block text-xs text-muted">{t("A different tone for each notification and action, on this device")}</span>
                </span>
              </label>
              <button type="button" onClick={() => preview("new_request")} className="btn btn-secondary btn-sm shrink-0">{t("Test sound")}</button>
            </div>
            {sound && blocked && (
              <p className="alert alert-warn mt-2 text-xs">{t("Sound is blocked. Tap anywhere on the page once, then press Test sound. If you still hear nothing, turn up the phone's media volume and check it is not on silent.")}</p>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-accent">{t("Hear the tones")}</summary>
              <p className="mb-1 mt-2 text-xs font-medium text-muted">{t("Notifications")}</p>
              <ul className="flex flex-col gap-2">{mine(NOTIFICATION_TONES).map((tone) => <ToneRow key={tone.kind} tone={tone} />)}</ul>
              <p className="mb-1 mt-3 text-xs font-medium text-muted">{t("Your own actions")}</p>
              <ul className="flex flex-col gap-2">{mine(ACTION_TONES).map((tone) => <ToneRow key={tone.kind} tone={tone} />)}</ul>
            </details>
          </div>

          <div className="border-t border-line pt-3">
            <p className="text-sm font-medium">{t("Device notifications")}</p>
            <p className="mb-2 text-xs text-muted">{t("Alerts on this device even when the app is closed, using the device's own notification sound.")}</p>
            {push === "unsupported" && <p className="text-xs text-muted">{t("Not available in this browser. Install the app on an Android phone to use it.")}</p>}
            {push === "blocked" && <p className="alert alert-warn text-xs">{t("Notifications are blocked for this site. Allow them in the browser's site settings.")}</p>}
            {(push === "off" || push === "busy" || push === "checking") && (
              <button type="button" disabled={push !== "off"} onClick={enablePush} className="btn btn-primary btn-sm">
                {push === "busy" ? t("Working…") : t("Turn on device notifications")}
              </button>
            )}
            {push === "on" && (
              <div className="flex items-center justify-between gap-2">
                <span className="badge bg-success-soft text-success">{t("On for this device")}</span>
                <button type="button" onClick={disablePush} className="btn btn-secondary btn-sm">{t("Turn off")}</button>
              </div>
            )}
            {pushError && <p role="alert" className="alert alert-error mt-2 text-xs">{t(pushError)}</p>}
          </div>
        </div>
      )}

      {/* Rendered on the page body: the header's blur effect would otherwise trap fixed banners inside it. */}
      {mounted &&
        createPortal(
          <div className="fixed inset-x-3 bottom-4 z-30 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96">
            {locked && (
              <div role="alert" className="card flex items-center gap-3 border-warn/50 bg-warn-soft p-3 shadow-lg">
                <span className="min-w-0 flex-1 text-sm text-warn">{t("Sound is off until you tap. Phones keep it locked until then.")}</span>
                <button type="button" onClick={enableSound} className="btn btn-primary btn-sm shrink-0">{t("Enable sound")}</button>
              </div>
            )}
            {push === "off" && !promptHidden && (
              <div className="card flex flex-col gap-2 p-3 shadow-lg">
                <p className="text-sm font-medium">{t("Get alerts even when the app is closed")}</p>
                <p className="text-xs text-muted">{t("Your phone will ring with its own notification sound when something needs you.")}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={enablePush} className="btn btn-primary btn-sm">{t("Turn on")}</button>
                  <button type="button" onClick={hidePrompt} className="btn btn-secondary btn-sm">{t("Not now")}</button>
                </div>
              </div>
            )}
            {toast && (
              <div role="status" aria-live="polite" className="card flex items-start gap-3 border-accent/50 p-4 shadow-lg">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full ${DOT[toast.kind] ?? "bg-accent"}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{toast.title}</p>
                  <p className="text-sm text-muted">{toast.body}</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={toast.url} onClick={() => setToast(null)} className="btn btn-primary btn-sm">{t("View")}</Link>
                    <button type="button" onClick={() => setToast(null)} className="btn btn-secondary btn-sm">{t("Dismiss")}</button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
