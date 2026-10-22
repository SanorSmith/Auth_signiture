// Tones for every notification and action in the app, synthesised with the Web Audio API so no audio
// files are needed. Notifications from other people last 2 to 3 seconds and each sounds different;
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
  | "deleted";

type Voice = { f: number; at: number; dur: number; peak: number; type?: OscillatorType; warm?: boolean; bell?: boolean };

// A score is a few notes; `warm` adds a quiet octave above, `bell` the inharmonic partial of a struck bell.
const SCORES: Record<ToneKind, Voice[]> = {
  // A bright rising chime: E5, A5, C#6.
  new_request: [
    { f: 659.25, at: 0, dur: 1.4, peak: 0.22, warm: true },
    { f: 880, at: 0.22, dur: 1.6, peak: 0.22, warm: true },
    { f: 1108.73, at: 0.44, dur: 2.2, peak: 0.22, warm: true },
  ],
  // An attention triple pulse that settles on a held note.
  reset_requested: [
    { f: 880, at: 0, dur: 0.25, peak: 0.18, type: "triangle" },
    { f: 880, at: 0.35, dur: 0.25, peak: 0.18, type: "triangle" },
    { f: 880, at: 0.7, dur: 0.25, peak: 0.18, type: "triangle" },
    { f: 659.25, at: 1.1, dur: 1.5, peak: 0.2, warm: true },
  ],
  // A happy bell arpeggio: C5, E5, G5, C6.
  code_issued: [
    { f: 523.25, at: 0, dur: 1.0, peak: 0.2, bell: true },
    { f: 659.25, at: 0.18, dur: 1.1, peak: 0.2, bell: true },
    { f: 783.99, at: 0.36, dur: 1.2, peak: 0.2, bell: true },
    { f: 1046.5, at: 0.54, dur: 1.9, peak: 0.2, bell: true },
  ],
  // Two soft falling notes.
  request_denied: [
    { f: 440, at: 0, dur: 1.2, peak: 0.2, type: "triangle" },
    { f: 329.63, at: 0.35, dur: 1.85, peak: 0.2, type: "triangle" },
  ],
  // Three descending steps, like something being taken away.
  request_removed: [
    { f: 392, at: 0, dur: 0.9, peak: 0.22 },
    { f: 293.66, at: 0.5, dur: 0.9, peak: 0.22 },
    { f: 196, at: 1.0, dur: 1.15, peak: 0.22 },
  ],
  // A gentle chord that blossoms: C5, E5, G5, B5.
  access_changed: [
    { f: 523.25, at: 0, dur: 2.0, peak: 0.12 },
    { f: 659.25, at: 0.25, dur: 2.0, peak: 0.12 },
    { f: 783.99, at: 0.5, dur: 2.0, peak: 0.12 },
    { f: 987.77, at: 0.75, dur: 2.05, peak: 0.12 },
  ],
  // Short confirmations of your own actions.
  sent: [
    { f: 783.99, at: 0, dur: 0.18, peak: 0.14 },
    { f: 1046.5, at: 0.12, dur: 0.3, peak: 0.14 },
  ],
  found: [{ f: 1318.5, at: 0, dur: 0.8, peak: 0.13, warm: true }],
  missing: [
    { f: 220, at: 0, dur: 0.25, peak: 0.16, type: "triangle" },
    { f: 196, at: 0.2, dur: 0.4, peak: 0.16, type: "triangle" },
  ],
  error: [{ f: 174.61, at: 0, dur: 0.45, peak: 0.07, type: "sawtooth" }],
  // Any action of yours that went through (generate, save, create, reset...).
  done: [
    { f: 880, at: 0, dur: 0.16, peak: 0.16 },
    { f: 1318.5, at: 0.1, dur: 0.35, peak: 0.16 },
  ],
  // Something was denied, removed or deleted: two short falling notes.
  deleted: [
    { f: 392, at: 0, dur: 0.18, peak: 0.18, type: "triangle" },
    { f: 261.63, at: 0.12, dur: 0.4, peak: 0.18, type: "triangle" },
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
};

// Length of each tone in seconds (when its last note has faded out).
export const toneSeconds = (kind: ToneKind) => Math.max(...SCORES[kind].map((v) => v.at + v.dur));

export const isToneKind = (value: string): value is ToneKind => value in SCORES;

export type ToneInfo = { kind: ToneKind; label: string; hint: string; needs?: Permission };

// Notifications from other people: 2 to 3 seconds, each its own melody.
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

// Browsers only allow sound after the person has touched the page once.
export async function unlockAudio(): Promise<boolean> {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
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
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

// Phone speakers are small, so the tones are about twice as loud as the raw notes in the scores.
const LOUDNESS = 2.2;

// One note. It rises in 20 ms, settles, then fades over most of its length, so a 2.5 second tone is
// audible for about 2.5 seconds (a plain exponential fade to silence is inaudible after the first moments).
function note(c: BaseAudioContext, out: AudioNode, freq: number, start: number, duration: number, peak: number, type: OscillatorType) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const top = peak * LOUDNESS;
  const g = gain.gain;
  g.setValueAtTime(0.0001, start);
  g.linearRampToValueAtTime(top, start + 0.02);
  if (duration > 0.3) {
    g.exponentialRampToValueAtTime(top * 0.4, start + duration * 0.45);
    g.exponentialRampToValueAtTime(top * 0.06, start + duration - 0.12);
    g.linearRampToValueAtTime(0.0001, start + duration);
  } else {
    g.exponentialRampToValueAtTime(0.0001, start + duration);
  }
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Schedules every note of a tone on any audio context (the real one, or an offline one for tests).
export function scheduleScore(c: BaseAudioContext, out: AudioNode, kind: ToneKind, t: number) {
  for (const v of SCORES[kind]) {
    note(c, out, v.f, t + v.at, v.dur, v.peak, v.type ?? "sine");
    if (v.warm) note(c, out, v.f * 2, t + v.at, v.dur * 0.6, v.peak * 0.2, "sine");
    if (v.bell) {
      note(c, out, v.f * 2.76, t + v.at, v.dur * 0.55, v.peak * 0.3, "sine");
      note(c, out, v.f * 5.4, t + v.at, v.dur * 0.3, v.peak * 0.12, "sine");
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
export async function signal(kind: ToneKind): Promise<boolean> {
  try {
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {}
  if (!soundEnabled()) return true;
  return playTone(kind);
}
