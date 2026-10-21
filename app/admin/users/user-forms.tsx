"use client";

import { useActionState, useEffect, useState } from "react";
import { createUser, deleteUser, resetPassword, updateUser } from "@/lib/user-actions";
import { PasswordInput } from "../../password-input";

const roleStyle: Record<string, string> = {
  admin: "bg-accent-soft text-accent",
  client: "bg-page text-muted border border-line",
  monitor: "bg-success-soft text-success",
};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="new-email" className="label">Email</label>
        <input id="new-email" name="email" type="email" required placeholder="name@company.com" className="input" />
      </div>
      <div>
        <label htmlFor="new-password" className="label">Initial password</label>
        <PasswordInput id="new-password" name="password" minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" />
      </div>
      <div>
        <label htmlFor="new-role" className="label">Role</label>
        <select id="new-role" name="role" defaultValue="client" className="input">
          <option value="client">Client</option>
          <option value="monitor">Monitor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create user"}</button>
      {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
      {state?.ok && <p role="status" className="alert alert-success">{state.ok}</p>}
    </form>
  );
}

type Props = { id: number; email: string; role: string; isSelf: boolean; resetRequested: boolean; created: string };

export function UserRow({ id, email, role, isSelf, resetRequested, created }: Props) {
  const [saved, save, saving] = useActionState(updateUser, null);
  const [reset, doReset, resetting] = useActionState(resetPassword, null);
  const [removed, remove, removing] = useActionState(deleteUser, null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (saved?.ok) setEditing(false);
  }, [saved]);

  return (
    <div className={`card flex flex-col gap-3 p-4 ${resetRequested ? "border-danger/50" : ""}`}>
      {!editing ? (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold uppercase text-accent">
            {email[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{email}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className={`badge capitalize ${roleStyle[role] ?? ""}`}>{role}</span>
              {resetRequested && <span className="badge bg-danger text-white">Reset requested</span>}
              <span>Created {created}</span>
              {isSelf && <span>· You</span>}
            </p>
          </div>
        </div>
      ) : (
        <form action={save} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={id} />
          <div className="min-w-0 flex-1">
            <label htmlFor={`email-${id}`} className="label">Email</label>
            <input id={`email-${id}`} name="email" type="email" defaultValue={email} required className="input" />
          </div>
          <div>
            <label htmlFor={`role-${id}`} className="label">Role</label>
            <select id={`role-${id}`} name="role" defaultValue={role} disabled={isSelf} className="input" title={isSelf ? "You can't change your own role" : undefined}>
              <option value="client">Client</option>
              <option value="monitor">Monitor</option>
              <option value="admin">Admin</option>
            </select>
            {/* A disabled select isn't submitted, so keep the admin's own role explicit. */}
            {isSelf && <input type="hidden" name="role" value="admin" />}
          </div>
          <div className="flex gap-2">
            <button disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Edit</button>
          <form action={doReset}>
            <input type="hidden" name="id" value={id} />
            <button disabled={resetting} className="btn btn-secondary btn-sm">{resetting ? "Resetting…" : "Reset password"}</button>
          </form>
          {!isSelf && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm ml-auto">Delete</button>
          )}
          {!isSelf && confirming && (
            <form action={remove} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <span className="text-xs text-muted">Delete this user?</span>
              <button disabled={removing} className="btn btn-danger btn-sm">Yes, delete</button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">Cancel</button>
            </form>
          )}
        </div>
      )}

      {saved?.error && <p role="alert" className="alert alert-error">{saved.error}</p>}
      {removed?.error && <p role="alert" className="alert alert-error">{removed.error}</p>}
      {reset?.error && <p role="alert" className="alert alert-error">{reset.error}</p>}
      {reset?.code && (
        <div className="alert alert-success flex flex-col gap-2">
          <p>{reset.ok}</p>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-surface px-2 py-1 font-mono text-base text-ink">{reset.code}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(reset.code!)} className="btn btn-secondary btn-sm">Copy</button>
          </div>
          <p className="text-xs opacity-80">Give this to the user. They must choose a new password when they sign in.</p>
        </div>
      )}
    </div>
  );
}
