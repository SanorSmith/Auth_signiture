"use client";

import { useActionState, useRef, useState } from "react";
import { addSupplier, removeSupplier } from "@/lib/allow-actions";
import { signal } from "@/lib/tones";
import { useActionTone } from "@/lib/use-action-tone";
import { useT } from "../../lang-provider";

export function AddSupplier() {
  const t = useT();
  const form = useRef<HTMLFormElement>(null);
  const [state, add, adding] = useActionState(async (prev: Parameters<typeof addSupplier>[0], data: FormData) => {
    const next = await addSupplier(prev, data);
    if (next?.ok) form.current?.reset();
    return next;
  }, null);
  useActionTone(state, "done", true);
  return (
    <form ref={form} action={add} className="card flex flex-col gap-2 p-4">
      <label className="text-sm font-medium" htmlFor="supplier-name">{t("Supplier name")}</label>
      <div className="flex gap-2">
        <input id="supplier-name" name="name" maxLength={36} autoComplete="off" required className="input min-w-0 flex-1" />
        <button disabled={adding} className="btn btn-primary">{adding ? t("Adding…") : t("Add")}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}
    </form>
  );
}

export function RemoveSupplier({ id }: { id: number }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, remove, removing] = useActionState(removeSupplier, null);
  useActionTone(state, "deleted", true);
  return confirming ? (
    <form action={remove} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-muted">{t("Remove this supplier from the list?")}</span>
      <button disabled={removing} onClick={() => void signal("deleted")} className="btn btn-danger btn-sm">{removing ? t("Removing…") : t("Yes, remove")}</button>
      <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">{t("Cancel")}</button>
    </form>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm">{t("Remove")}</button>
  );
}
