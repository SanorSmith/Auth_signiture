"use client";

import { useActionState, useEffect, useRef } from "react";
import { lookupVerification } from "@/lib/actions";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter,
// so a focused input that submits on Enter is all that is needed. The same input also works
// with the on-screen numeric keyboard (Go key or the Show code button).
export function Scanner() {
  const [state, action, pending] = useActionState(lookupVerification, null);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const refocus = () => {
    if (input.current) {
      input.current.value = "";
      input.current.focus();
    }
  };

  useEffect(() => {
    refocus();
    const t = setTimeout(refocus, 0);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <main
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-6"
      onClick={(e) => e.target === e.currentTarget && input.current?.focus()}
    >
      <form ref={form} action={action} className="flex w-full max-w-sm flex-col gap-3">
        <input
          ref={input}
          name="code"
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          placeholder="Scan or type the 10-digit code"
          className="w-full rounded border bg-transparent px-3 py-2 text-center font-mono text-lg"
        />
        <button disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          Show code
        </button>
      </form>
      {pending && <p className="text-neutral-500">Looking up…</p>}
      {!pending && state?.vcode && (
        <p className="font-mono text-8xl font-bold tracking-widest">{state.vcode}</p>
      )}
      {!pending && state?.error && <p className="text-2xl text-red-600">{state.error}</p>}
      {!state && !pending && <p className="text-neutral-500">Waiting for a scan…</p>}
    </main>
  );
}
