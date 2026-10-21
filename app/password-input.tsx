"use client";

import { useState, type ComponentProps } from "react";

// Password field with a show/hide toggle.
export function PasswordInput({ className = "", ...props }: ComponentProps<"input">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${className} w-full pr-16`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-2 px-2 text-sm text-neutral-500 hover:text-black dark:hover:text-white"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
