// Notification tones, synthesised with the Web Audio API so no audio files are needed.
export type ToneId = "chime" | "bell" | "pulse";

export const TONES: { id: ToneId; label: string; hint: string }[] = [
  { id: "chime", label: "Chime", hint: "Two soft rising notes" },
  { id: "bell", label: "Bell", hint: "A single clear bell" },
  { id: "pulse", label: "Soft pulse", hint: "Two short, gentle beeps" },
];

let ctx: AudioContext | null = null;

// Browsers only allow sound after the person has touched the page once.
export async function unlockAudio(): Promise<boolean> {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

// One note: a quick attack and a smooth exponential fade sound clean, with no click.
function note(freq: number, start: number, duration: number, peak: number, type: OscillatorType = "sine") {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Resolves to false when the browser still blocks sound.
export async function playTone(id: ToneId): Promise<boolean> {
  if (!(await unlockAudio()) || !ctx) return false;
  const t = ctx.currentTime + 0.02;
  if (id === "chime") {
    // E5 then A5, each with a quiet octave above for a rounder sound.
    note(659.25, t, 1.0, 0.22);
    note(1318.5, t, 0.6, 0.04);
    note(880, t + 0.2, 1.3, 0.22);
    note(1760, t + 0.2, 0.7, 0.04);
  } else if (id === "bell") {
    // G5 with inharmonic partials, the way a struck bell rings.
    note(783.99, t, 1.8, 0.2);
    note(783.99 * 2.76, t, 1.1, 0.07);
    note(783.99 * 5.4, t, 0.6, 0.03);
  } else {
    note(987.77, t, 0.16, 0.18, "triangle");
    note(987.77, t + 0.24, 0.16, 0.18, "triangle");
  }
  return true;
}
