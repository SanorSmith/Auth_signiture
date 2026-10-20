import { createHmac, randomInt } from "node:crypto";

const LETTERS = 26;
const DIGITS = 100_000;
// Total verification codes: A00000..Z99999
export const VCODE_SPACE = LETTERS * DIGITS;

// Multiplier must be coprime to 2,600,000 (= 2^6 * 5^5 * 13) so the map is a bijection.
const MULTIPLIER = 1_234_567;

export const CODE_RE = /^\d{10}$/;

function secret() {
  const s = process.env.CODE_HMAC_SECRET;
  if (!s) throw new Error("CODE_HMAC_SECRET is not set");
  return s;
}

// Keyed hash: the 10-digit number itself is never stored.
export function hashCode(code10: string) {
  return createHmac("sha256", secret()).update(code10).digest("hex");
}

export function generateCode10() {
  return String(randomInt(0, 10_000_000_000)).padStart(10, "0");
}

// Maps a running counter to a letter + 5 digits. Every value in the space is
// produced exactly once per cycle; after VCODE_SPACE issues the cycle restarts.
export function vcodeFromCounter(counter: number) {
  const offset = parseInt(
    createHmac("sha256", secret()).update("vcode-offset").digest("hex").slice(0, 8),
    16,
  ) % VCODE_SPACE;
  const i = (MULTIPLIER * (counter % VCODE_SPACE) + offset) % VCODE_SPACE;
  const letter = String.fromCharCode(65 + Math.floor(i / DIGITS));
  return letter + String(i % DIGITS).padStart(5, "0");
}
