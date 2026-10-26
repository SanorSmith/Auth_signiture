"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword } from "@/lib/account-actions";
import { useActionTone } from "@/lib/use-action-tone";
import { AuthCard } from "../auth-card";
import { useT } from "../lang-provider";

export default function ForgotPage() {
  const t = useT();
  const [state, action, pending] = useActionState(forgotPassword, null);
  useActionTone(state, "sent");
  return (
    <AuthCard title="Forgot password" description="Enter your email. The admin is notified and will give you a temporary password.">
      <form action={action} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="label">{t("Email")}</label>
          <input id="email" name="email" type="email" required autoComplete="username" placeholder="you@company.com" className="input" />
        </div>
        <button disabled={pending} className="btn btn-primary w-full">{pending ? t("Sending…") : t("Notify the admin")}</button>
        {state?.error && <p role="alert" className="alert alert-error">{t(state.error)}</p>}
        {state?.ok && <p role="status" className="alert alert-success">{t(state.ok)}</p>}
      </form>
      <Link href="/login" className="mt-5 block text-center text-sm font-medium text-accent hover:underline">{t("Back to sign in")}</Link>
    </AuthCard>
  );
}
