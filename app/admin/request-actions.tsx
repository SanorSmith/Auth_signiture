"use client";

import { useActionState, useState } from "react";
import { denyRequest, issueRequest, removeRequest } from "@/lib/actions";
import { signal } from "@/lib/tones";
import { useActionTone } from "@/lib/use-action-tone";
import { useT } from "../lang-provider";

// Actions for a pending request: generate its code, or deny it (after a confirmation).
export function PendingActions({ id }: { id: number }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, deny, denying] = useActionState(denyRequest, null);
  useActionTone(state, "deleted", true);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {state?.error && <span role="alert" className="mr-auto text-xs text-danger">{t(state.error)}</span>}
      {!confirming ? (
        <>
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm">{t("Deny")}</button>
          <form action={issueRequest}>
            <input type="hidden" name="id" value={id} />
            {/* The row leaves the list once the code is issued, so the sound plays on the click itself. */}
            <button onClick={() => void signal("done")} className="btn btn-primary btn-sm">{t("Generate")}</button>
          </form>
        </>
      ) : (
        <form action={deny} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-xs text-muted">{t("Deny this request?")}</span>
          <button disabled={denying} onClick={() => void signal("deleted")} className="btn btn-danger btn-sm">{denying ? t("Denying…") : t("Yes, deny")}</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">{t("Cancel")}</button>
        </form>
      )}
    </div>
  );
}

// Action for a confirmed request: remove it for good (after a confirmation).
export function RemoveAction({ id }: { id: number }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, remove, removing] = useActionState(removeRequest, null);
  useActionTone(state, "deleted", true);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {state?.error && <span role="alert" className="mr-auto text-xs text-danger">{t(state.error)}</span>}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm">{t("Remove")}</button>
      ) : (
        <form action={remove} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-xs text-muted">{t("Remove this request? Its code stops working on the monitor.")}</span>
          <button disabled={removing} onClick={() => void signal("deleted")} className="btn btn-danger btn-sm">{removing ? t("Removing…") : t("Yes, remove")}</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">{t("Cancel")}</button>
        </form>
      )}
    </div>
  );
}
