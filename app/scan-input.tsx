"use client";

import { useEffect, useState, type RefObject } from "react";
import { useT } from "./lang-provider";

type Props = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  // Changes after every submit: the box clears, refocuses and the keyboard goes away again.
  resetKey: unknown;
  pattern?: string;
};

// Number box for a hardware scanner. By default it has focus but no on-screen keyboard
// (inputMode="none"), so a Zebra scanner can type into it without a keyboard covering the page.
// "Type with keyboard" switches to the numeric keypad for entering a number by hand.
export function ScanInput({ id, name, label, placeholder, inputRef, resetKey, pattern }: Props) {
  const t = useT();
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.value = "";
    setManual(false);
    el.focus();
  }, [resetKey, inputRef]);

  // Re-focus after the mode changes so the keyboard shows or hides straight away.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.blur();
    el.focus();
  }, [manual, inputRef]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="label">{t(label)}</label>
        <button
          type="button"
          // Keep focus in the box so the scanner keeps typing into it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setManual((m) => !m)}
          className="mb-1 text-xs font-medium text-accent hover:underline"
        >
          {manual ? t("Hide keyboard") : t("Type with keyboard")}
        </button>
      </div>
      <input
        id={id}
        ref={inputRef}
        name={name}
        autoFocus
        autoComplete="off"
        inputMode={manual ? "numeric" : "none"}
        pattern={pattern}
        maxLength={10}
        placeholder={t(placeholder)}
        className="input py-3 text-center font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
      />
    </div>
  );
}
