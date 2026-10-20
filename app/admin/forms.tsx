"use client";

import { useActionState } from "react";
import { createUser, issueVerification } from "@/lib/actions";

const input = "rounded border bg-transparent px-3 py-2";
const button = "rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black";

export function IssueForm() {
  const [state, action, pending] = useActionState(issueVerification, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="code" inputMode="numeric" pattern="\d{10}" maxLength={10} placeholder="10-digit number from client" required autoFocus className={`${input} font-mono`} />
      <button disabled={pending} className={button}>{pending ? "Working…" : "Generate"}</button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.vcode && (
        <p className="rounded border p-4 text-center font-mono text-4xl tracking-widest">{state.vcode}</p>
      )}
    </form>
  );
}

export function UserForm() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="email" type="email" placeholder="Email" required className={input} />
      <input name="password" type="password" placeholder="Password (min 8)" minLength={8} required autoComplete="new-password" className={input} />
      <select name="role" defaultValue="client" className={input}>
        <option value="client">client</option>
        <option value="monitor">monitor</option>
        <option value="admin">admin</option>
      </select>
      <button disabled={pending} className={button}>{pending ? "Creating…" : "Create"}</button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">{state.ok}</p>}
    </form>
  );
}
