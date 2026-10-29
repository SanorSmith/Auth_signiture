import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const LETTERS = 26;
const DIGITS = 100_000;
// Total verification codes: A00000..Z99999
export const VCODE_SPACE = LETTERS * DIGITS;

// Multiplier must be coprime to 2,600,000 (= 2^6 * 5^5 * 13) so the map is a bijection.
const MULTIPLIER = 1_234_567;

export const CODE_RE = /^\d{10}$/;
export const NOTE_MAX = 80;

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

// A request must say who delivers and what: how many pallets, bundles and boxes. Most deliveries are
// one type; a mixed delivery has a number for each. They are kept together in the request's note,
// which is what the admin sees, for example "Acme Freight · 2 Pallet · 6 Box". The types are stored in
// English and shown in the person's language (Pall, Bunt, Kartong in Swedish).
export const SUPPLIER_MAX = 36;
export const COUNT_MAX = 999;
export const DELIVERY_TYPES = ["Pallet", "Bundle", "Box"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

// Older versions of the app sent one number and one type; these words still map to a type.
const LEGACY_TYPES: Record<string, string> = {
  pallet: "Pallet", pall: "Pallet",
  bundle: "Bundle", bunt: "Bundle",
  box: "Box", carton: "Box", kartong: "Box", lada: "Box", låda: "Box",
  pack: "Pack", pak: "Pack",
};

const tidy = (v: unknown) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

export function deliveryNote(
  supplierRaw: unknown,
  counts: Partial<Record<DeliveryType, unknown>>,
  legacy?: { colli?: unknown; type?: unknown },
): { note: string } | { error: string } {
  const supplier = tidy(supplierRaw);
  if (supplier.length < 2) return { error: "Enter the supplier name" };
  if (supplier.length > SUPPLIER_MAX) return { error: `The supplier name can be at most ${SUPPLIER_MAX} characters` };

  const parts: string[] = [];
  for (const type of DELIVERY_TYPES) {
    const text = String(counts[type] ?? "").trim();
    if (text === "" || text === "0") continue;
    if (!/^\d{1,3}$/.test(text)) return { error: `Each number can be from 1 to ${COUNT_MAX}` };
    parts.push(`${Number(text)} ${type}`);
  }
  // An older app: one number and one type.
  if (parts.length === 0 && String(legacy?.colli ?? "").trim() !== "") {
    const n = String(legacy?.colli).trim();
    const type = LEGACY_TYPES[tidy(legacy?.type).toLowerCase()];
    if (!/^\d{1,3}$/.test(n) || Number(n) < 1) return { error: `Each number can be from 1 to ${COUNT_MAX}` };
    if (!type) return { error: "Enter how many pallets, bundles or boxes" };
    parts.push(`${Number(n)} ${type}`);
  }
  if (parts.length === 0) return { error: "Enter how many pallets, bundles or boxes" };
  return { note: [supplier, ...parts].join(" · ") };
}

// Requests made before the types had their own numbers read "Acme · 12 colli · Pallet". They are shown as
// "Acme · 12 Pallet", without the word "colli", and an old Carton is a Box. The stored text is not changed.
export function plainNote(note: string): string;
export function plainNote(note: string | null | undefined): string | null | undefined;
export function plainNote(note: string | null | undefined): string | null | undefined {
  if (!note) return note;
  return note
    .replace(/ · (\d+) colli · (Carton|Pallet|Bundle|Box|Pack|Bag|Crate|Roll|Drum)\b/g, (_, n: string, type: string) => ` · ${n} ${type === "Carton" ? "Box" : type}`)
    .replace(/ · (\d+) colli\b/g, " · $1");
}
