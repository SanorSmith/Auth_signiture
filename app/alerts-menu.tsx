"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPushKey, removePushSubscription, savePushSubscription } from "@/lib/push-actions";
import { TONES, playTone, unlockAudio, type ToneId } from "@/lib/tones";

type Settings = { sound: boolean; tone: ToneId };
type Latest = { email: string; note: string | null };
type PushState = "checking" | "unsupported" | "off" | "on" | "blocked" | "busy";

const STORAGE_KEY = "alert-settings";
const POLL_MS = 4000;

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { sound: raw.sound !== false, tone: TONES.some((t) => t.id === raw.tone) ? raw.tone : "chime" };
  } catch {
    return { sound: true, tone: "chime" };
  }
}

function keyToBytes(b64: string) {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Bell in the header for people who manage requests. While the app is open it plays a tone, vibrates
// and shows a banner when a request arrives; with device notifications on, the phone alerts even when closed.
export function AlertsMenu() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({ sound: true, tone: "chime" });
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<Latest | null>(null);
  const [push, setPush] = useState<PushState>("checking");
  const [pushError, setPushError] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const lastSeen = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  settingsRef.current = settings;

  useEffect(() => setSettings(loadSettings()), []);

  const update = (next: Partial<Settings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {}
  };

  // Sound needs one touch on the page first; do it on the first interaction.
  useEffect(() => {
    const unlock = async () => {
      if (await unlockAudio()) setBlocked(false);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const announce = useCallback(async (latest: Latest) => {
    if (settingsRef.current.sound) {
      const played = await playTone(settingsRef.current.tone);
      setBlocked(!played);
    }
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {}
    setToast(latest);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 12000);
  }, []);

  // Ask the server every few seconds whether a newer request is waiting.
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        if (res.status === 401) {
          stopped = true;
          return;
        }
        const data = (await res.json()) as { pending: number; latestAt: number; latest: Latest | null };
        setPending(data.pending);
        // The first answer only sets the baseline, so requests already waiting don't ring on page load.
        if (lastSeen.current !== null && data.latestAt > lastSeen.current && data.latest) void announce(data.latest);
        lastSeen.current = data.latestAt;
      } catch {
        // Offline for a moment; the next poll tries again.
      }
    };
    void check();
    const timer = setInterval(() => !stopped && void check(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(toastTimer.current);
    };
  }, [announce]);

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

  const tryTone = async (id: ToneId) => setBlocked(!(await playTone(id)));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Request alerts"
        aria-expanded={open}
        className="btn btn-secondary btn-sm relative !px-2.5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
          {!settings.sound && <path d="M4 4l16 16" />}
        </svg>
        {pending > 0 && (
          <span className="badge absolute -right-1.5 -top-1.5 min-w-5 justify-center bg-danger px-1 text-[10px] text-white">{pending}</span>
        )}
      </button>

      {open && (
        <div className="card fixed inset-x-3 top-14 z-20 flex flex-col gap-4 p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Request alerts</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">Close</button>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(e) => update({ sound: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-medium">Play a sound</span>
              <span className="block text-xs text-muted">When a request arrives and this page is open</span>
            </span>
          </label>

          {settings.sound && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="tone" className="label">Tone</label>
                <select id="tone" value={settings.tone} onChange={(e) => update({ tone: e.target.value as ToneId })} className="input">
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">{TONES.find((t) => t.id === settings.tone)?.hint}</p>
              </div>
              <button type="button" onClick={() => tryTone(settings.tone)} className="btn btn-secondary">Play</button>
            </div>
          )}
          {settings.sound && blocked && (
            <p className="alert alert-warn text-xs">Your browser is blocking sound. Tap anywhere on the page once to allow it, then press Play.</p>
          )}

          <div className="border-t border-line pt-3">
            <p className="font-medium text-sm">Device notifications</p>
            <p className="mb-2 text-xs text-muted">Alerts on this device even when the app is closed, using the device&apos;s own notification sound.</p>
            {push === "unsupported" && <p className="text-xs text-muted">Not available in this browser. Install the app on an Android phone to use it.</p>}
            {push === "blocked" && <p className="alert alert-warn text-xs">Notifications are blocked for this site. Allow them in the browser&apos;s site settings.</p>}
            {(push === "off" || push === "busy" || push === "checking") && (
              <button type="button" disabled={push !== "off"} onClick={enablePush} className="btn btn-primary btn-sm">
                {push === "busy" ? "Working…" : "Turn on device notifications"}
              </button>
            )}
            {push === "on" && (
              <div className="flex items-center justify-between gap-2">
                <span className="badge bg-success-soft text-success">On for this device</span>
                <button type="button" onClick={disablePush} className="btn btn-secondary btn-sm">Turn off</button>
              </div>
            )}
            {pushError && <p role="alert" className="alert alert-error mt-2 text-xs">{pushError}</p>}
          </div>
        </div>
      )}

      {/* Rendered on the page body: the header's blur effect would otherwise trap a fixed banner inside it. */}
      {toast &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="card fixed inset-x-3 bottom-4 z-30 flex items-start gap-3 border-accent/50 p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:w-96"
          >
            <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">New request</p>
              <p className="truncate text-sm text-muted">{toast.email}</p>
              {toast.note && <p className="truncate text-sm">{toast.note}</p>}
              <div className="mt-3 flex gap-2">
                <Link href="/admin" onClick={() => setToast(null)} className="btn btn-primary btn-sm">View</Link>
                <button type="button" onClick={() => setToast(null)} className="btn btn-secondary btn-sm">Dismiss</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
