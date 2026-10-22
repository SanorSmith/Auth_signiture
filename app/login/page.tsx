"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions";
import { useActionTone } from "@/lib/use-action-tone";
import { AuthCard } from "../auth-card";
import { PasswordInput } from "../password-input";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  useActionTone(state);
  return (
    <AuthCard title="Sign in" description="Use the account your admin gave you.">
      <form action={action} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" placeholder="you@company.com" className="input" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link href="/forgot" className="mb-1 text-xs font-medium text-accent hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="password" name="password" required autoComplete="current-password" placeholder="Your password" />
        </div>
        <button disabled={pending} className="btn btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button>
        {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
      </form>
    </AuthCard>
  );
}
