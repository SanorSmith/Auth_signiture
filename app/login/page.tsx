"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form action={action} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required autoComplete="username" className="rounded border bg-transparent px-3 py-2" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" className="rounded border bg-transparent px-3 py-2" />
        <button disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {pending ? "Signing in…" : "Sign in"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}
