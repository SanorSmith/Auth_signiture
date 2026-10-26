"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "@/lib/lang-actions";
import { useLang, useT } from "./lang-provider";

// SV | EN. Changes the language straight away.
export function LangSwitch() {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (next: "sv" | "en") => {
    if (next === lang) return;
    start(async () => {
      await setLanguage(next);
      router.refresh();
    });
  };
  return (
    <div role="group" aria-label={t("Language")} className={`inline-flex overflow-hidden rounded-md border border-line text-xs font-medium ${pending ? "opacity-60" : ""}`}>
      {(["sv", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 uppercase transition ${lang === l ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
