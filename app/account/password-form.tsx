"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/account-actions";
import { PasswordInput } from "../password-input";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="current" className="label">Current password</label>
        <PasswordInput id="current" name="current" required autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="next" className="label">New password</label>
        <PasswordInput id="next" name="next" minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repeat new password</label>
        <PasswordInput id="confirm" name="confirm" minLength={8} required autoComplete="new-password" />
      </div>
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Change password"}</button>
      {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
    </form>
  );
}
