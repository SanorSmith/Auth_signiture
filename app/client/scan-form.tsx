"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestVerification } from "@/lib/actions";
import { DELIVERY_TYPES, SUPPLIER_MAX, type DeliveryType } from "@/lib/codes";
import { signal } from "@/lib/tones";
import { useT } from "../lang-provider";
import { ScanInput } from "../scan-input";

// What the form sends for each type: Pallet, Bundle and Box each have their own number.
const FIELD: Record<DeliveryType, string> = { Pallet: "pallet", Bundle: "bundle", Box: "box" };
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 3);

// A Zebra scanner in keyboard (HID / DataWedge) mode types the digits and presses Enter.
// Type the supplier and what is delivered first, then scan: the scan submits the request with them.
// Most deliveries are one type (choose it, give its number). A mixed delivery shows a number for each type.
export function ScanForm() {
  const t = useT();
  const [state, action, pending] = useActionState(requestVerification, null);
  const code = useRef<HTMLInputElement>(null);
  const numberBox = useRef<HTMLInputElement>(null);
  const [supplier, setSupplier] = useState("");
  const [mixed, setMixed] = useState(false);
  const [type, setType] = useState<DeliveryType | "">("");
  const [count, setCount] = useState("");
  const [counts, setCounts] = useState<Record<DeliveryType, string>>({ Pallet: "", Bundle: "", Box: "" });

  useEffect(() => {
    if (state?.ok) {
      setSupplier("");
      setType("");
      setCount("");
      setCounts({ Pallet: "", Bundle: "", Box: "" });
      setMixed(false);
    }
    // A short sound confirms what just happened to your scan.
    if (state?.ok) void signal("sent");
    else if (state?.error) void signal("error");
  }, [state]);

  // Enter in a box moves on to the next one instead of submitting; the last one moves to the scan box.
  const next = (e: React.KeyboardEvent, go: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="supplier" className="label">{t("Supplier name")}</label>
        <input
          id="supplier"
          name="supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          onKeyDown={(e) => next(e, () => (mixed ? document.getElementById("count-Pallet") : numberBox.current)?.focus())}
          maxLength={SUPPLIER_MAX}
          required
          autoComplete="off"
          placeholder={t("Who delivers?")}
          className="input"
        />
      </div>

      {!mixed ? (
        <>
          <fieldset>
            <legend className="label">{t("Type")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_TYPES.map((ty) => (
                <label
                  key={ty}
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                    type === ty ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-page"
                  }`}
                >
                  <input type="radio" name="type" value={ty} checked={type === ty} onChange={() => setType(ty)} required className="sr-only" />
                  {t(ty)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="count" className="label">{t("Number")}</label>
            <input
              id="count"
              ref={numberBox}
              value={count}
              onChange={(e) => setCount(digits(e.target.value))}
              onKeyDown={(e) => next(e, () => code.current?.focus())}
              inputMode="numeric"
              required
              autoComplete="off"
              placeholder={t("How many?")}
              className="input"
            />
            {/* The number goes to the server under the chosen type's name. */}
            {type && <input type="hidden" name={FIELD[type]} value={count} />}
          </div>
        </>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="label">{t("How many of each type?")}</legend>
          {DELIVERY_TYPES.map((ty, i) => (
            <div key={ty} className="flex items-center gap-3">
              <label htmlFor={`count-${ty}`} className="w-24 shrink-0 text-sm font-medium">{t(ty)}</label>
              <input
                id={`count-${ty}`}
                name={FIELD[ty]}
                value={counts[ty]}
                onChange={(e) => setCounts((c) => ({ ...c, [ty]: digits(e.target.value) }))}
                onKeyDown={(e) =>
                  next(e, () => (i < DELIVERY_TYPES.length - 1 ? document.getElementById(`count-${DELIVERY_TYPES[i + 1]}`) : code.current)?.focus())
                }
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                className="input"
              />
            </div>
          ))}
        </fieldset>
      )}

      <button type="button" onClick={() => setMixed((m) => !m)} className="self-start text-sm font-medium text-accent hover:underline">
        {mixed ? t("Only one type") : t("Mixed delivery")}
      </button>

      <ScanInput id="code" name="code" label="10-digit number" placeholder="Scan the number" inputRef={code} resetKey={state} />
      {/* With text inputs, Enter (the scanner's suffix) only submits when a submit button exists. */}
      <button disabled={pending} className="btn btn-primary">{pending ? t("Sending…") : t("Send request")}</button>
      {!pending && state?.ok && <p role="status" className="alert alert-success">{t(state.ok)}</p>}
      {!pending && state?.error && <p role="alert" className="alert alert-error">{t(state.error)}</p>}
    </form>
  );
}
