"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestVerification } from "@/lib/actions";
import { NOTE_MAX } from "@/lib/codes";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter.
// Type the note first, then scan: the scan submits the request together with the note.
export function ScanForm() {
  const [state, action, pending] = useActionState(requestVerification, null);
  const code = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (code.current) {
      code.current.value = "";
      code.current.focus();
    }
    if (state?.ok) setNote("");
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="note" className="label">Note <span className="font-normal">(optional)</span></label>
          <span className="mb-1 text-xs text-muted">{note.length}/{NOTE_MAX}</span>
        </div>
        <input
          id="note"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            // Enter in the note box moves on to the scan box instead of submitting.
            if (e.key === "Enter") {
              e.preventDefault();
              code.current?.focus();
            }
          }}
          maxLength={NOTE_MAX}
          autoComplete="off"
          placeholder="What is this request for?"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="code" className="label">10-digit number</label>
        <input
          id="code"
          ref={code}
          name="code"
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          maxLength={10}
          placeholder="Scan or type the number"
          className="input py-3 text-center font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
        />
      </div>
      {/* With two text inputs, Enter (the scanner's suffix) only submits when a submit button exists. */}
      <button disabled={pending} className="btn btn-primary">{pending ? "Sending…" : "Send request"}</button>
      {!pending && state?.ok && <p role="status" className="alert alert-success">{state.ok}</p>}
      {!pending && state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
    </form>
  );
}
