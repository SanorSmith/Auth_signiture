"use client";

import { useActionState, useRef } from "react";
import { lookupVerification } from "@/lib/actions";
import { ScanInput } from "../scan-input";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter,
// so a focused input that submits on Enter is all that is needed. The scan box shows no
// on-screen keyboard unless "Type with keyboard" is switched on.
export function Scanner() {
  const [state, action, pending] = useActionState(lookupVerification, null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex flex-col gap-3 sm:gap-5"
      onClick={(e) => e.target === e.currentTarget && input.current?.focus()}
    >
      <form action={action} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-6">
        <div className="flex-1">
          <ScanInput id="code" name="code" label="10-digit number" placeholder="Scan the number" inputRef={input} resetKey={state} pattern="\d{10}" />
        </div>
        <button disabled={pending} className="btn btn-primary py-3 sm:px-6">Show code</button>
      </form>

      <section
        role="status"
        aria-live="polite"
        className={`card order-first flex min-h-40 flex-col items-center justify-center gap-2 p-4 text-center sm:order-none sm:min-h-80 sm:p-6 ${
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
