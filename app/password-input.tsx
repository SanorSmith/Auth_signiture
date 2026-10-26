"use client";

import { useState, type ComponentProps } from "react";
import { useT } from "./lang-provider";

// Password field with a show/hide toggle.
export function PasswordInput({ className = "", ...props }: ComponentProps<"input">) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`input pr-16 ${className}`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? t("Hide password") : t("Show password")}
        className="absolute inset-y-0 right-1.5 my-1.5 rounded-md px-2 text-xs font-medium text-muted transition hover:bg-page hover:text-ink"
      >
        {shown ? t("Hide") : t("Show")}
      </button>
    </div>
  );
}
