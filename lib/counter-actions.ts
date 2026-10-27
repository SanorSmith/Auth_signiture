"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requirePermission } from "./session";
import {
  counterAdjust,
  counterCancel,
  counterFinish,
  counterResolve,
  counterScan,
  counterSetExpected,
  counterState,
  counterUndo,
  forgetAllRules,
  forgetRule,
  setNoteCompareEnabled,
} from "./counter";

// The colli counter's actions for the website. Each one is for the signed-in person's own count only.
const me = () => requirePermission("colli_counter");

export async function loadCounter() {
  return counterState((await me()).uid);
}

export async function scanPackage(code: string) {
  return counterScan((await me()).uid, code);
}

export async function resolveScan(code: string, choice: "ignore" | "count" | "new") {
  const s = await me();
  return counterResolve(s.uid, s.email, code, choice);
}

export async function adjustMatch(delta: number) {
  return counterAdjust((await me()).uid, delta);
}

export async function setExpected(expected: number | null) {
  return counterSetExpected((await me()).uid, expected);
}

export async function undoScan() {
  return counterUndo((await me()).uid);
}

export async function cancelCount() {
  return counterCancel((await me()).uid);
}

export async function finishCount() {
  const s = await me();
  return counterFinish(s.uid, s.email);
}

// What the counter has learned about package codes: only administrators review and edit it.
export async function forgetRememberedRule(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await forgetRule(id);
  revalidatePath("/counter/rules");
}

export async function forgetAllRememberedRules() {
  await requireAdmin();
  await forgetAllRules();
  revalidatePath("/counter/rules");
}

// Turning the delivery note comparison on or off for everyone.
export async function switchNoteCompare(formData: FormData) {
  await requireAdmin();
  await setNoteCompareEnabled(formData.get("on") === "1");
  revalidatePath("/counter", "layout");
}
