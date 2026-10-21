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
    <div className="flex w-full flex-col items-center gap-3">
      <form action={action} className="flex w-full flex-col gap-2">
        <div className="relative">
          <input
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
            placeholder="Describe this request (optional)"
            className="w-full rounded border bg-transparent px-3 py-2 pr-14"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
        <input
          ref={code}
          name="code"
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          maxLength={10}
          placeholder="Scan the 10-digit number"
          className="w-full rounded border bg-transparent px-3 py-2 text-center font-mono text-lg"
        />
        {/* With two text inputs, Enter (the scanner's suffix) only submits when a submit button exists. */}
        <button disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          Send request
        </button>
      </form>
      {pending && <p className="text-neutral-500">Sending…</p>}
      {!pending && state?.ok && <p className="text-green-600">{state.ok}</p>}
      {!pending && state?.error && <p className="text-red-600">{state.error}</p>}
    </div>
  );
}
