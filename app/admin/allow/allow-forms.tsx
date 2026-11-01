"use client";

import { useActionState, useRef, useState } from "react";
import { addSupplier, pauseSupplier, removeSupplier, switchAutoCodes } from "@/lib/allow-actions";
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

// Pause or resume one supplier: a paused supplier's requests wait for you again.
export function SupplierSwitch({ id, active }: { id: number; active: boolean }) {
  const t = useT();
  const [state, save, saving] = useActionState(pauseSupplier, null);
  useActionTone(state, "done", true);
  return (
    <form action={save}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button disabled={saving} className="btn btn-secondary btn-sm">{active ? t("Pause") : t("Activate")}</button>
    </form>
  );
}

// The master switch: while automatic codes are paused, every request waits for an administrator.
export function AutoCodesSwitch({ on }: { on: boolean }) {
  const t = useT();
  const [state, save, saving] = useActionState(switchAutoCodes, null);
  useActionTone(state, "done", true);
  return (
    <form action={save} className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${on ? "" : "border-warn/60"}`}>
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <div className="min-w-0">
        <p className="font-medium">{on ? t("Automatic codes are on") : t("Automatic codes are paused")}</p>
        <p className="text-xs text-muted">{on ? t("Requests from suppliers on the list get their code at once.") : t("Every request waits for you to confirm it.")}</p>
      </div>
      <button disabled={saving} className={`btn btn-sm ${on ? "btn-secondary" : "btn-primary"}`}>{on ? t("Pause all") : t("Resume")}</button>
    </form>
  );
}
