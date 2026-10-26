"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestVerification } from "@/lib/actions";
import { COLLI_TYPES, SUPPLIER_MAX } from "@/lib/codes";
import { signal } from "@/lib/tones";
import { useT } from "../lang-provider";
import { ScanInput } from "../scan-input";

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter.
// Type the supplier and the number of colli first, then scan: the scan submits the request with them.
export function ScanForm() {
  const t = useT();
  const [state, action, pending] = useActionState(requestVerification, null);
  const code = useRef<HTMLInputElement>(null);
  const [supplier, setSupplier] = useState("");
  const [colli, setColli] = useState("");
  const [colliType, setColliType] = useState("");
  const colliBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      setSupplier("");
      setColli("");
      setColliType("");
    }
    // A short sound confirms what just happened to your scan.
    if (state?.ok) void signal("sent");
    else if (state?.error) void signal("error");
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="supplier" className="label">{t("Supplier name")}</label>
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
          placeholder={t("Who delivers?")}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="colli" className="label">{t("Number of colli")}</label>
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
          placeholder={t("How many packages?")}
          className="input"
        />
      </div>
      <fieldset>
        <legend className="label">{t("Colli type")}</legend>
        <div className="grid grid-cols-4 gap-2">
          {COLLI_TYPES.map((ct) => (
            <label
              key={ct}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                colliType === ct ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-page"
              }`}
            >
              <input
                type="radio"
                name="colliType"
                value={ct}
                checked={colliType === ct}
                onChange={() => setColliType(ct)}
                required
                className="sr-only"
              />
              {t(ct)}
            </label>
          ))}
        </div>
      </fieldset>
      <ScanInput id="code" name="code" label="10-digit number" placeholder="Scan the number" inputRef={code} resetKey={state} />
      {/* With two text inputs, Enter (the scanner's suffix) only submits when a submit button exists. */}
      <button disabled={pending} className="btn btn-primary">{pending ? t("Sending…") : t("Send request")}</button>
      {!pending && state?.ok && <p role="status" className="alert alert-success">{t(state.ok)}</p>}
      {!pending && state?.error && <p role="alert" className="alert alert-error">{t(state.error)}</p>}
    </form>
  );
}
