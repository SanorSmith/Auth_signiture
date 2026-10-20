"use client";

import { useActionState } from "react";
import Barcode from "react-barcode";
import { createClientCode } from "@/lib/actions";

export function CodeGenerator() {
  const [state, action, pending] = useActionState(createClientCode, null);
  return (
    <div className="flex flex-col items-center gap-4">
      <form action={action}>
        <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {pending ? "Generating…" : "Get my code"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.code && (
        <div className="flex flex-col items-center gap-2 rounded border bg-white p-4 text-black">
          <p className="font-mono text-3xl tracking-widest">{state.code}</p>
          <Barcode value={state.code} format="CODE128" displayValue={false} height={60} />
          <p className="max-w-xs text-center text-xs text-neutral-600">
            Send this number to the admin. It is shown only once and is not stored, so note it down before leaving this page.
          </p>
        </div>
      )}
    </div>
  );
}
