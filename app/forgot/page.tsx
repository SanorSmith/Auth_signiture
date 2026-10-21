"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword } from "@/lib/account-actions";
import { AuthCard } from "../auth-card";

export default function ForgotPage() {
  const [state, action, pending] = useActionState(forgotPassword, null);
  return (
    <AuthCard title="Forgot password" description="Enter your email. The admin is notified and will give you a temporary password.">
      <form action={action} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" placeholder="you@company.com" className="input" />
        </div>
        <button disabled={pending} className="btn btn-primary w-full">{pending ? "Sending…" : "Notify the admin"}</button>
        {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
        {state?.ok && <p role="status" className="alert alert-success">{state.ok}</p>}
      </form>
      <Link href="/login" className="mt-5 block text-center text-sm font-medium text-accent hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}
