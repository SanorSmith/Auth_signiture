"use client";

import { useState } from "react";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

type Props = {
  idPrefix: string;
  // Permissions the signed-in user may hand out (everything for an administrator).
  options: Permission[];
  defaults: Permission[];
  adminAllowed: boolean;
  adminDefault?: boolean;
  // Editing your own account: keep administrator switched on.
  lockAdmin?: boolean;
};

const box = "flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-2.5 text-sm transition hover:bg-page has-[:disabled]:cursor-default has-[:disabled]:opacity-70";

// Checkboxes for what a user may do. "Administrator" gives everything and disables the rest.
export function PermissionPicker({ idPrefix, options, defaults, adminAllowed, adminDefault = false, lockAdmin = false }: Props) {
  const [admin, setAdmin] = useState(adminDefault);
  const [chosen, setChosen] = useState<Set<string>>(new Set(defaults));
  const shown = PERMISSIONS.filter((p) => options.includes(p.key));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label">Permissions</legend>
      {adminAllowed && (
        <label className={`${box} border-accent/40 bg-accent-soft`}>
          <input
            type="checkbox"
            name={lockAdmin ? undefined : "admin"}
            checked={admin}
            disabled={lockAdmin}
            onChange={(e) => setAdmin(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          {/* A disabled checkbox isn't submitted, so keep the administrator flag explicit. */}
          {lockAdmin && <input type="hidden" name="admin" value="on" />}
          <span>
            <span className="block font-medium">Administrator</span>
            <span className="block text-xs text-muted">Full access, including editing permissions</span>
          </span>
        </label>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((p) => (
          <label key={`${idPrefix}-${p.key}`} className={box}>
            <input
              type="checkbox"
              name="perm"
              value={p.key}
              checked={admin || chosen.has(p.key)}
              disabled={admin}
              onChange={(e) =>
                setChosen((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(p.key);
                  else next.delete(p.key);
                  return next;
                })
              }
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-muted">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
