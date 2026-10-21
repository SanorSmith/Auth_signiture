"use client";

import { useActionState, useState } from "react";
import { createUser, deleteUser, resetPassword, updateUser } from "@/lib/user-actions";
import { PasswordInput } from "../../password-input";

const input = "rounded border bg-transparent px-3 py-2";
const button = "rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black";
const ghost = "rounded border px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="email" type="email" placeholder="Email" required className={input} />
      <PasswordInput name="password" placeholder="Initial password (min 8)" minLength={8} required autoComplete="new-password" className={input} />
      <select name="role" defaultValue="client" className={input}>
        <option value="client">client</option>
        <option value="monitor">monitor</option>
        <option value="admin">admin</option>
      </select>
      <button disabled={pending} className={button}>{pending ? "Creating…" : "Create user"}</button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">{state.ok}</p>}
    </form>
  );
}

type Props = { id: number; email: string; role: string; isSelf: boolean; resetRequested: boolean; created: string };

export function UserRow({ id, email, role, isSelf, resetRequested, created }: Props) {
  const [saved, save, saving] = useActionState(updateUser, null);
  const [reset, doReset, resetting] = useActionState(resetPassword, null);
  const [removed, remove, removing] = useActionState(deleteUser, null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={`flex flex-col gap-3 rounded border p-3 ${resetRequested ? "border-red-500" : ""}`}>
      {resetRequested && <p className="text-sm font-medium text-red-600">Asked for a password reset</p>}

      <form action={save} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="id" value={id} />
        <input name="email" type="email" defaultValue={email} required className={`${input} min-w-0 flex-1`} />
        <select name="role" defaultValue={role} disabled={isSelf} className={input} title={isSelf ? "You can't change your own role" : undefined}>
          <option value="client">client</option>
          <option value="monitor">monitor</option>
          <option value="admin">admin</option>
        </select>
        {/* A disabled select isn't submitted, so keep the admin's own role explicit. */}
        {isSelf && <input type="hidden" name="role" value="admin" />}
        <button disabled={saving} className={ghost}>{saving ? "Saving…" : "Save"}</button>
      </form>
      {saved?.error && <p className="text-sm text-red-600">{saved.error}</p>}
      {saved?.ok && <p className="text-sm text-green-600">{saved.ok}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">Created {created}</span>
        <form action={doReset} className="ml-auto">
          <input type="hidden" name="id" value={id} />
          <button disabled={resetting} className={ghost}>{resetting ? "Resetting…" : "Reset password"}</button>
        </form>
        {!isSelf && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className={`${ghost} text-red-600`}>Delete</button>
        )}
        {!isSelf && confirming && (
          <form action={remove} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <span className="text-sm">Delete this user?</span>
            <button disabled={removing} className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">Yes, delete</button>
            <button type="button" onClick={() => setConfirming(false)} className={ghost}>Cancel</button>
          </form>
        )}
      </div>
      {removed?.error && <p className="text-sm text-red-600">{removed.error}</p>}
      {reset?.error && <p className="text-sm text-red-600">{reset.error}</p>}
      {reset?.code && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-green-600 p-3">
          <span className="text-sm">{reset.ok}</span>
          <code className="font-mono text-lg">{reset.code}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(reset.code!)} className={ghost}>Copy</button>
          <p className="w-full text-xs text-neutral-500">Give this to the user. They must choose a new password when they sign in.</p>
        </div>
      )}
    </div>
  );
}
