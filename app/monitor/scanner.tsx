"use client";

import { useActionState, useEffect, useRef } from "react";
import { lookupVerification } from "@/lib/actions";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter,
// so a focused input that submits on Enter is all that is needed. The same input also works
// with the on-screen numeric keyboard (Go key or the Show code button).
export function Scanner() {
  const [state, action, pending] = useActionState(lookupVerification, null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.current) {
      input.current.value = "";
      input.current.focus();
    }
  }, [state]);

  return (
    <div
      className="flex flex-col gap-5"
      onClick={(e) => e.target === e.currentTarget && input.current?.focus()}
    >
      <form action={action} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:p-6">
        <div className="flex-1">
          <label htmlFor="code" className="label">10-digit number</label>
          <input
            id="code"
            ref={input}
            name="code"
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            placeholder="Scan or type the number"
            className="input py-3 text-center font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
          />
        </div>
        <button disabled={pending} className="btn btn-primary py-3 sm:px-6">Show code</button>
      </form>

      <section
        role="status"
        aria-live="polite"
        className={`card flex min-h-64 flex-col items-center justify-center gap-2 p-6 text-center sm:min-h-80 ${
          state?.vcode ? "border-success/40 bg-success-soft" : ""
        }`}
      >
        {pending && <p className="text-muted">Looking up…</p>}
        {!pending && state?.vcode && (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-success">Verification code</p>
            {/* Scales with the screen width so the 6 characters always fit, even on small handhelds. */}
            <p className="whitespace-nowrap font-mono text-[clamp(2rem,15vw,6rem)] font-bold tracking-widest text-success">{state.vcode}</p>
          </>
        )}
        {!pending && state?.error && (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-warn">Not available</p>
            <p className="text-xl font-medium">{state.error}</p>
          </>
        )}
        {!pending && !state && <p className="text-muted">Ready. Waiting for a scan…</p>}
      </section>
    </div>
  );
}
