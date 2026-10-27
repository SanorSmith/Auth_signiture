// Deciding which scanned packages belong to the same shipment, for any carrier.
//
// Nobody scans a shipment label, only the package IDs. Packages of one shipment share the start of
// their ID and differ at the end. The first package is the reference; the second shows where the two
// IDs start to differ, and everything before that is "the shipment part". Every later scan must have
// the same length and the same shipment part. The last MIN_TAIL characters may always differ, so the
// rule does not break when package numbers pass from 99 to 100.

export const MIN_TAIL = 3;
export const CODE_MIN = 4;
export const CODE_MAX = 64;

export type Rule = { len: number; prefix: number };

// Scanners add nothing visible, but labels print "(00) 3735..." and people type spaces and dashes.
export function normalizeCode(raw: unknown): string | null {
  const code = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= CODE_MIN && code.length <= CODE_MAX ? code : null;
}

export function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// The rule shown by two IDs, or null when they do not look like the same shipment.
export function learnRule(first: string, second: string): Rule | null {
  if (first.length !== second.length) return null;
  const len = first.length;
  const shared = commonPrefix(first, second);
  if (shared < Math.max(CODE_MIN, Math.ceil(len * 0.4))) return null;
  const prefix = Math.max(1, Math.min(shared, len - MIN_TAIL));
  return { len, prefix };
}

// Does this ID belong to the shipment that `reference` started?
export function fits(rule: Rule, reference: string, code: string): boolean {
  return code.length === rule.len && code.startsWith(reference.slice(0, rule.prefix));
}

// The user widens or narrows the matched part with the + and - buttons.
export function adjustRule(rule: Rule, delta: number): Rule {
  const prefix = Math.min(rule.len - 1, Math.max(1, rule.prefix + delta));
  return { len: rule.len, prefix };
}
