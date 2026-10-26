"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/account-actions";
import { useActionTone } from "@/lib/use-action-tone";
import { useT } from "../lang-provider";
import { PasswordInput } from "../password-input";

export function PasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState(changePassword, null);
  useActionTone(state);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="current" className="label">{t("Current password")}</label>
        <PasswordInput id="current" name="current" required autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="next" className="label">{t("New password")}</label>
        <PasswordInput id="next" name="next" minLength={8} required autoComplete="new-password" placeholder={t("At least 8 characters")} />
      </div>
      <div>
        <label htmlFor="confirm" className="label">{t("Repeat new password")}</label>
        <PasswordInput id="confirm" name="confirm" minLength={8} required autoComplete="new-password" />
      </div>
      <button disabled={pending} className="btn btn-primary">{pending ? t("Saving…") : t("Change password")}</button>
      {state?.error && <p role="alert" className="alert alert-error">{t(state.error)}</p>}
    </form>
  );
}
