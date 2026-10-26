"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestVerification } from "@/lib/actions";
import { COLLI_TYPES, COLLI_TYPE_MAX, SUPPLIER_MAX } from "@/lib/codes";
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
  const typeBox = useRef<HTMLInputElement>(null);
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
              typeBox.current?.focus();
            }
          }}
          inputMode="numeric"
          required
          autoComplete="off"
          placeholder={t("How many packages?")}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="colliType" className="label">{t("Colli type")}</label>
        <input
          id="colliType"
          name="colliType"
          ref={typeBox}
          list="colli-types"
          value={colliType}
          onChange={(e) => setColliType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              code.current?.focus();
            }
          }}
          maxLength={COLLI_TYPE_MAX}
          required
          autoComplete="off"
          placeholder={t("Pallet, box, carton…")}
          className="input"
        />
        <datalist id="colli-types">{COLLI_TYPES.map((ct) => <option key={ct} value={t(ct)} />)}</datalist>
      </div>
      <ScanInput id="code" name="code" label="10-digit number" placeholder="Scan the number" inputRef={code} resetKey={state} />
      {/* With two text inputs, Enter (the scanner's suffix) only submits when a submit button exists. */}
      <button disabled={pending} className="btn btn-primary">{pending ? t("Sending…") : t("Send request")}</button>
      {!pending && state?.ok && <p role="status" className="alert alert-success">{t(state.ok)}</p>}
      {!pending && state?.error && <p role="alert" className="alert alert-error">{t(state.error)}</p>}
    </form>
  );
}
