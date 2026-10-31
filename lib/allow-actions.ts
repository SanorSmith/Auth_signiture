"use server";

import { revalidatePath } from "next/cache";
import { addAllowed, removeAllowed } from "./allow-list";
import { requireAdmin } from "./session";
import type { State } from "./actions";

// Allow list: only administrators decide which suppliers get their code without confirmation.
export async function addSupplier(_: State, form: FormData): Promise<State> {
  const s = await requireAdmin();
  const result = await addAllowed(form.get("name"), s.email);
  revalidatePath("/admin/allow");
  return "error" in result ? { error: result.error } : { ok: "Added" };
}

export async function removeSupplier(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid request" };
  await removeAllowed(id);
  revalidatePath("/admin/allow");
  return { ok: "Removed" };
}
