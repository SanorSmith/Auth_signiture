"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/account-actions";
import { PasswordInput } from "../password-input";

const input = "rounded border bg-transparent px-3 py-2";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <PasswordInput name="current" placeholder="Current password" required autoComplete="current-password" className={input} />
      <PasswordInput name="next" placeholder="New password (min 8)" minLength={8} required autoComplete="new-password" className={input} />
      <PasswordInput name="confirm" placeholder="Repeat new password" minLength={8} required autoComplete="new-password" className={input} />
      <button disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {pending ? "Saving…" : "Change password"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
