"use client";

import { useState, type ComponentProps } from "react";

// Password field with a show/hide toggle.
export function PasswordInput({ className = "", ...props }: ComponentProps<"input">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`input pr-16 ${className}`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1.5 my-1.5 rounded-md px-2 text-xs font-medium text-muted transition hover:bg-page hover:text-ink"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
