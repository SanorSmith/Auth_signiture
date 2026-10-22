"use client";

import { useEffect } from "react";
import { signal, type ToneKind } from "./tones";

// Plays a short sound when an action finishes: `okTone` when it went through, the error tone when
// it was refused. Use it with the state from useActionState. With `errorsOnly` the success sound is
// left to the caller (for buttons whose row disappears, so they play on the click instead).
export function useActionTone(state: { ok?: string; error?: string } | null, okTone: ToneKind = "done", errorsOnly = false) {
  useEffect(() => {
    if (state?.error) void signal("error");
    else if (state?.ok && !errorsOnly) void signal(okTone);
  }, [state, okTone, errorsOnly]);
}
