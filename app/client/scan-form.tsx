"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestVerification } from "@/lib/actions";
import { SUPPLIER_MAX } from "@/lib/codes";
import { signal } from "@/lib/tones";
import { ScanInput } from "../scan-input";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter.
// Type the supplier and the number of colli first, then scan: the scan submits the request with them.
export function ScanForm() {
  const [state, action, pending] = useActionState(requestVerification, null);
  const code = useRef<HTMLInputElement>(null);
  const [supplier, setSupplier] = useState("");
  const [colli, setColli] = useState("");
  const colliBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      setSupplier("");
      setColli("");
    }
    // A short sound confirms what just happened to your scan.
    if (state?.ok) void signal("sent");
    else if (state?.error) void signal("error");
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="supplier" className="label">Supplier name</label>
        <input
          id="supplier"
          name="supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          onKeyDown={(e) => {
            // Enter moves on to the next box instead of submitting.
            if (e.key === "Enter") {
              e.preventDefault();
              colliBox.current?.focus();
            }
          }}
          maxLength={SUPPLIER_MAX}
          required
          autoComplete="off"
          placeholder="Who delivers?"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="colli" className="label">Number of colli</label>
        <input
          id="colli"
          name="colli"
          ref={colliBox}
          value={colli}
          onChange={(e) => setColli(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              code.current?.focus();
            }
          }}
          inputMode="numeric"
          required
          autoComplete="off"
          placeholder="How many packages?"
          className="input"
        />
      </div>
      <ScanInput id="code" name="code" label="10-digit number" placeholder="Scan the number" inputRef={code} resetKey={state} />
      {/* With two text inputs, Enter (the scanner's suffix) only submits when a submit button exists. */}
      <button disabled={pending} className="btn btn-primary">{pending ? "Sending…" : "Send request"}</button>
      {!pending && state?.ok && <p role="status" className="alert alert-success">{state.ok}</p>}
      {!pending && state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
    </form>
  );
}
