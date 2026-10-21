"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword } from "@/lib/account-actions";

export default function ForgotPage() {
  const [state, action, pending] = useActionState(forgotPassword, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="text-sm text-neutral-500">Enter your email. The admin gets a notification and will give you a temporary password.</p>
      <form action={action} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required autoComplete="username" className="rounded border bg-transparent px-3 py-2" />
        <button disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {pending ? "Sending…" : "Notify the admin"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-600">{state.ok}</p>}
      </form>
      <Link href="/login" className="text-sm underline">Back to sign in</Link>
    </main>
  );
}
