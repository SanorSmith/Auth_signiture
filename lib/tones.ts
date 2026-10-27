// Tones for every notification and action in the app, synthesised with the Web Audio API so no audio
// files are needed. Notifications from other people are one or two struck notes, about a third of a second, and each sounds different;
// the sounds that confirm your own action are short so scanning stays quick.
import type { Permission } from "./permissions";

export type ToneKind =
  | "new_request"
  | "reset_requested"
  | "code_issued"
  | "request_denied"
  | "request_removed"
  | "access_changed"
  | "sent"
  | "found"
  | "missing"
  | "error"
  | "done"
  | "deleted"
  | "counted"
  | "duplicate"
  | "mismatch"
  | "finished";

type Voice = { f: number; at: number; dur: number; peak: number; type?: OscillatorType; warm?: boolean; bell?: boolean; pluck?: boolean; rich?: boolean };

// A score is a few notes; `warm` adds a quiet octave above, `bell` the inharmonic partial of a struck bell.
const SCORES: Record<ToneKind, Voice[]> = {
  // Notifications from other people: one or two struck notes, about a third of a second. Each has its
  // own melody and sound, so they can be told apart without looking.
  // New request (for the admin): two bright bell notes going up, G5 then D6.
  new_request: [
    { f: 783.99, at: 0, dur: 0.22, peak: 0.24, bell: true, pluck: true },
    { f: 1174.66, at: 0.1, dur: 0.34, peak: 0.26, bell: true, pluck: true },
  ],
  // Password reset: one clear high bell ping, F6.
  reset_requested: [{ f: 1396.91, at: 0, dur: 0.4, peak: 0.24, bell: true, pluck: true }],
  // Code ready (for the client): a quick happy sparkle, C6 E6 G6.
  code_issued: [
    { f: 1046.5, at: 0, dur: 0.18, peak: 0.2, bell: true, pluck: true },
    { f: 1318.5, at: 0.07, dur: 0.18, peak: 0.2, bell: true, pluck: true },
    { f: 1568, at: 0.14, dur: 0.32, peak: 0.22, bell: true, pluck: true },
  ],
  // Denied: two soft notes falling, A4 then E4. Gentle, not alarming.
  request_denied: [
    { f: 440, at: 0, dur: 0.24, peak: 0.26, type: "triangle", warm: true, pluck: true },
    { f: 329.63, at: 0.12, dur: 0.34, peak: 0.26, type: "triangle", warm: true, pluck: true },
  ],
  // Removed: one low, soft thump, G3.
  request_removed: [{ f: 196, at: 0, dur: 0.38, peak: 0.34, type: "triangle", warm: true, pluck: true }],
  // Access changed: two notes together, a soft open chord, E5 and B5.
  access_changed: [
    { f: 659.25, at: 0, dur: 0.4, peak: 0.18, bell: true, pluck: true },
    { f: 987.77, at: 0, dur: 0.4, peak: 0.16, bell: true, pluck: true },
  ],
  // Short confirmations of your own actions.
  sent: [
    { f: 783.99, at: 0, dur: 0.12, peak: 0.16, pluck: true },
    { f: 1046.5, at: 0.07, dur: 0.18, peak: 0.16, pluck: true },
  ],
  found: [{ f: 1318.5, at: 0, dur: 0.26, peak: 0.16, warm: true, pluck: true }],
  missing: [
    { f: 220, at: 0, dur: 0.15, peak: 0.2, type: "triangle", pluck: true },
    { f: 196, at: 0.11, dur: 0.22, peak: 0.2, type: "triangle", pluck: true },
  ],
  error: [{ f: 196, at: 0, dur: 0.26, peak: 0.17, type: "sawtooth", pluck: true }],
  // Any action of yours that went through (generate, save, create, reset...).
  done: [
    { f: 880, at: 0, dur: 0.1, peak: 0.16, pluck: true },
    { f: 1318.5, at: 0.07, dur: 0.2, peak: 0.16, pluck: true },
  ],
  // Something was denied, removed or deleted: two short falling notes.
  deleted: [
    { f: 392, at: 0, dur: 0.14, peak: 0.2, type: "triangle", pluck: true },
    { f: 261.63, at: 0.09, dur: 0.24, peak: 0.2, type: "triangle", pluck: true },
  ],
  // Colli counter. A quick tick for every package counted, so fast scanning stays quick.
  counted: [{ f: 1568, at: 0, dur: 0.09, peak: 0.16, pluck: true }],
  // The same package scanned twice: two short low beeps.
  duplicate: [
    { f: 330, at: 0, dur: 0.12, peak: 0.22, type: "triangle", pluck: true },
    { f: 330, at: 0.17, dur: 0.12, peak: 0.22, type: "triangle", pluck: true },
  ],
  // A package that does not belong to the shipment: a siren-like alert, about a second.
  mismatch: [
    { f: 880, at: 0, dur: 0.2, peak: 0.16, type: "sawtooth" },
    { f: 622.25, at: 0.22, dur: 0.2, peak: 0.16, type: "sawtooth" },
    { f: 880, at: 0.44, dur: 0.2, peak: 0.16, type: "sawtooth" },
    { f: 622.25, at: 0.66, dur: 0.3, peak: 0.16, type: "sawtooth" },
  ],
  // The count is finished and saved.
  finished: [
    { f: 523.25, at: 0, dur: 0.2, peak: 0.18, bell: true, pluck: true },
    { f: 659.25, at: 0.08, dur: 0.2, peak: 0.18, bell: true, pluck: true },
    { f: 783.99, at: 0.16, dur: 0.36, peak: 0.2, bell: true, pluck: true },
  ],
};

// How the phone vibrates for each tone.
const VIBRATION: Record<ToneKind, number[]> = {
  new_request: [180, 90, 180],
  reset_requested: [150, 80, 150, 80, 150],
  code_issued: [120, 60, 120, 60, 240],
  request_denied: [400],
  request_removed: [250, 120, 250],
  access_changed: [100, 60, 300],
  sent: [40],
  found: [60],
  missing: [120],
  error: [200],
  done: [40],
  deleted: [80],
  counted: [30],
  duplicate: [80, 60, 80],
  mismatch: [300, 120, 300, 120, 300],
  finished: [100, 60, 200],
};

// Length of each tone in seconds (when its last note has faded out).
export const toneSeconds = (kind: ToneKind) => Math.max(...SCORES[kind].map((v) => v.at + v.dur));

export const isToneKind = (value: string): value is ToneKind => value in SCORES;

export type ToneInfo = { kind: ToneKind; label: string; hint: string; needs?: Permission };

// Notifications from other people: one or two struck notes, about a third of a second each.
export const NOTIFICATION_TONES: ToneInfo[] = [
  { kind: "new_request", label: "New request", hint: "A client asked for a code", needs: "manage_requests" },
  { kind: "reset_requested", label: "Password reset", hint: "Someone asked for a password reset", needs: "reset_passwords" },
  { kind: "code_issued", label: "Code ready", hint: "The admin issued your code", needs: "request" },
  { kind: "request_denied", label: "Request denied", hint: "The admin denied your request", needs: "request" },
  { kind: "request_removed", label: "Request removed", hint: "The admin removed your request", needs: "request" },
  { kind: "access_changed", label: "Access changed", hint: "An admin changed what you can do" },
];

// Short sounds that confirm what you just did.
export const ACTION_TONES: ToneInfo[] = [
  { kind: "sent", label: "Request sent", hint: "Your scan went through", needs: "request" },
  { kind: "found", label: "Code found", hint: "The monitor found the code", needs: "monitor" },
  { kind: "missing", label: "Not found", hint: "No code for that number yet", needs: "monitor" },
  { kind: "done", label: "Done", hint: "An action went through" },
  { kind: "deleted", label: "Denied or removed", hint: "A request or user was denied, removed or deleted" },
  { kind: "counted", label: "Package counted", hint: "A package was added to the count", needs: "colli_counter" },
  { kind: "duplicate", label: "Package already counted", hint: "The same package was scanned twice", needs: "colli_counter" },
  { kind: "mismatch", label: "Wrong shipment", hint: "The package does not belong to this shipment", needs: "colli_counter" },
  { kind: "finished", label: "Count finished", hint: "The shipment count was saved", needs: "colli_counter" },
  { kind: "error", label: "Error", hint: "Something was not accepted" },
];

const STORAGE_KEY = "alert-settings";

// Sound is on unless the person switched it off on this device.
export function soundEnabled(): boolean {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").sound !== false;
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sound: on }));
  } catch {}
}

let ctx: AudioContext | null = null;
let master: AudioNode | null = null;

// The audio context, created on first use. It starts out "suspended" until the person touches the page.
function ensureContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    // Everything goes through a limiter, so the louder tones never distort on a small speaker.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 20;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    master = limiter;
  }
  return ctx;
}

// Can sound play right now? "locked" means the browser is waiting for a tap on the page.
export function audioState(): "running" | "locked" | "unsupported" {
  try {
    const c = ensureContext();
    if (!c) return "unsupported";
    return c.state === "running" ? "running" : "locked";
  } catch {
    return "unsupported";
  }
}

// Browsers only allow sound after the person has touched the page once.
export async function unlockAudio(): Promise<boolean> {
  try {
    const c = ensureContext();
    if (!c) return false;
    if (c.state !== "running") await c.resume();
    return c.state === "running";
  } catch {
    return false;
  }
}

// Phone speakers are small, so the tones are about twice as loud as the raw notes in the scores.
const LOUDNESS = 2.2;

// One note. A sustained note rises in 20 ms, settles, then fades over most of its length. A struck
// ("pluck") note jumps to full level in 5 ms and dies away like a bell or a marimba bar.
function note(c: BaseAudioContext, out: AudioNode, freq: number, start: number, duration: number, peak: number, type: OscillatorType, pluck = false, detune = 0) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (detune) osc.detune.value = detune;
  const top = peak * LOUDNESS;
  const g = gain.gain;
  g.setValueAtTime(0.0001, start);
  if (pluck) {
    g.linearRampToValueAtTime(top, start + 0.005);
    g.exponentialRampToValueAtTime(top * 0.03, start + duration - 0.02);
    g.linearRampToValueAtTime(0.0001, start + duration);
  } else {
    g.linearRampToValueAtTime(top, start + 0.02);
    if (duration > 0.3) {
      g.exponentialRampToValueAtTime(top * 0.4, start + duration * 0.45);
      g.exponentialRampToValueAtTime(top * 0.06, start + duration - 0.12);
      g.linearRampToValueAtTime(0.0001, start + duration);
    } else {
      g.exponentialRampToValueAtTime(0.0001, start + duration);
    }
  }
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Schedules every note of a tone on any audio context (the real one, or an offline one for tests).
export function scheduleScore(c: BaseAudioContext, out: AudioNode, kind: ToneKind, t: number) {
  for (const v of SCORES[kind]) {
    const wave = v.type ?? "sine";
    note(c, out, v.f, t + v.at, v.dur, v.peak, wave, v.pluck);
    // A second voice a few cents sharp makes the note fuller, less like a plain test tone.
    if (v.rich) note(c, out, v.f, t + v.at, v.dur, v.peak * 0.6, wave, v.pluck, 5);
    if (v.warm) note(c, out, v.f * 2, t + v.at, v.dur * 0.6, v.peak * 0.2, "sine", v.pluck);
    if (v.bell) {
      note(c, out, v.f * 2.76, t + v.at, v.dur * 0.55, v.peak * 0.3, "sine", v.pluck);
      note(c, out, v.f * 5.4, t + v.at, v.dur * 0.3, v.peak * 0.12, "sine", v.pluck);
    }
  }
}

// Plays a tone. Resolves to false when the browser still blocks sound.
export async function playTone(kind: ToneKind): Promise<boolean> {
  if (!(await unlockAudio()) || !ctx || !master) return false;
  scheduleScore(ctx, master, kind, ctx.currentTime + 0.02);
  return true;
}

// The tone and vibration for an event, unless sound is off on this device.
// Two parts of the page can report the same event (the bell and the page showing the result), so a
// tone for the same event is not played twice within a few seconds.
const lastPlayed = new Map<ToneKind, number>();

export async function signal(kind: ToneKind): Promise<boolean> {
  const now = Date.now();
  // Scan results and errors always sound: fast scanning means the same tone again within seconds.
  const always = kind === "error" || kind === "counted" || kind === "duplicate" || kind === "mismatch";
  if (!always && now - (lastPlayed.get(kind) ?? 0) < 4000) return true;
  lastPlayed.set(kind, now);
  try {
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {}
  if (!soundEnabled()) return true;
  return playTone(kind);
}
