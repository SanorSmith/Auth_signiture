"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestVerification } from "@/lib/actions";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter.
export function ScanForm() {
  const [state, action, pending] = useActionState(requestVerification, null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.current) {
      input.current.value = "";
      input.current.focus();
    }
  }, [state]);

  return (
    <div className="flex flex-col items-center gap-3">
      <form action={action} className="w-full">
        <input
          ref={input}
          name="code"
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          maxLength={10}
          placeholder="Scan the 10-digit number"
          className="w-full rounded border bg-transparent px-3 py-2 text-center font-mono text-lg"
        />
      </form>
      {pending && <p className="text-neutral-500">Sending…</p>}
      {!pending && state?.ok && <p className="text-green-600">{state.ok}</p>}
      {!pending && state?.error && <p className="text-red-600">{state.error}</p>}
      {!pending && state?.vcode && (
        <p className="rounded border p-4 font-mono text-4xl tracking-widest">{state.vcode}</p>
      )}
    </div>
  );
}
