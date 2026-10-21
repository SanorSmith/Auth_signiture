import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const LETTERS = 26;
const DIGITS = 100_000;
// Total verification codes: A00000..Z99999
export const VCODE_SPACE = LETTERS * DIGITS;

// Multiplier must be coprime to 2,600,000 (= 2^6 * 5^5 * 13) so the map is a bijection.
const MULTIPLIER = 1_234_567;

export const CODE_RE = /^\d{10}$/;
export const NOTE_MAX = 50;

function secret() {
  const s = process.env.CODE_HMAC_SECRET;
  if (!s) throw new Error("CODE_HMAC_SECRET is not set");
  return s;
}

// Keyed hash: the 10-digit number itself is never stored.
export function hashCode(code10: string) {
  return createHmac("sha256", secret()).update(code10).digest("hex");
}

// A scanned number waits for the admin encrypted (AES-256-GCM); it is wiped once the code is issued.
const pendingKey = () => createHash("sha256").update(`pending-key:${secret()}`).digest();

export function encryptPending(code10: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", pendingKey(), iv);
  const enc = Buffer.concat([c.update(code10, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptPending(blob: string) {
  const b = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", pendingKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
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
