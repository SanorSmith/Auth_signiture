"use client";

import { useEffect, useRef } from "react";
import { signal } from "@/lib/tones";

// The scan page refreshes itself every few seconds. When the admin's answer shows up (the code, or a
// denial) this plays its tone straight from what the page now shows, so it does not depend on the bell.
export function ResultTone({ vcode, denied }: { vcode: string | null; denied: boolean }) {
  const prev = useRef<{ vcode: string | null; denied: boolean } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { vcode, denied };
    if (!before) return; // what was already there on page load does not ring
    if (vcode && vcode !== before.vcode) void signal("code_issued");
    else if (!vcode && denied && !before.denied) void signal("request_denied");
  }, [vcode, denied]);
  return null;
}
