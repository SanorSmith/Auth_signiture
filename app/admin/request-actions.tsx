"use client";

import { useActionState, useState } from "react";
import { denyRequest, issueRequest, removeRequest } from "@/lib/actions";

// Actions for a pending request: generate its code, or deny it (after a confirmation).
export function PendingActions({ id }: { id: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, deny, denying] = useActionState(denyRequest, null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {state?.error && <span role="alert" className="mr-auto text-xs text-danger">{state.error}</span>}
      {!confirming ? (
        <>
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm">Deny</button>
          <form action={issueRequest}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-primary btn-sm">Generate</button>
          </form>
        </>
      ) : (
        <form action={deny} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-xs text-muted">Deny this request?</span>
          <button disabled={denying} className="btn btn-danger btn-sm">{denying ? "Denying…" : "Yes, deny"}</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">Cancel</button>
        </form>
      )}
    </div>
  );
}

// Action for a confirmed request: remove it for good (after a confirmation).
export function RemoveAction({ id }: { id: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, remove, removing] = useActionState(removeRequest, null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {state?.error && <span role="alert" className="mr-auto text-xs text-danger">{state.error}</span>}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm">Remove</button>
      ) : (
        <form action={remove} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-xs text-muted">Remove this request? Its code stops working on the monitor.</span>
          <button disabled={removing} className="btn btn-danger btn-sm">{removing ? "Removing…" : "Yes, remove"}</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">Cancel</button>
        </form>
      )}
    </div>
  );
}
