"use client";

import { useActionState, useEffect, useState } from "react";
import { createUser, deleteUser, resetPassword, updateUser } from "@/lib/user-actions";
import { ALL_PERMISSIONS, permissionLabel, type Permission } from "@/lib/permissions";
import { signal } from "@/lib/tones";
import { useActionTone } from "@/lib/use-action-tone";
import { useT } from "../../lang-provider";
import { PasswordInput } from "../../password-input";
import { PermissionPicker } from "./permission-picker";

export function CreateUserForm({ options, adminAllowed }: { options: Permission[]; adminAllowed: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(createUser, null);
  useActionTone(state);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="new-email" className="label">{t("Email")}</label>
        <input id="new-email" name="email" type="email" required placeholder="name@company.com" className="input" />
      </div>
      <div>
        <label htmlFor="new-password" className="label">{t("Initial password")}</label>
        <PasswordInput id="new-password" name="password" minLength={8} required autoComplete="new-password" placeholder={t("At least 8 characters")} />
      </div>
      <PermissionPicker idPrefix="new" options={options} defaults={[]} adminAllowed={adminAllowed} />
      <button disabled={pending} className="btn btn-primary">{pending ? t("Creating…") : t("Create user")}</button>
      {state?.error && <p role="alert" className="alert alert-error">{t(state.error)}</p>}
      {state?.ok && <p role="status" className="alert alert-success">{t(state.ok)}</p>}
    </form>
  );
}

type Props = {
  id: number;
  email: string;
  isAdmin: boolean;
  perms: Permission[];
  isSelf: boolean;
  resetRequested: boolean;
  created: string;
  canEdit: boolean;
  canReset: boolean;
  canDelete: boolean;
};

export function UserRow({ id, email, isAdmin, perms, isSelf, resetRequested, created, canEdit, canReset, canDelete }: Props) {
  const t = useT();
  const [saved, save, saving] = useActionState(updateUser, null);
  const [reset, doReset, resetting] = useActionState(resetPassword, null);
  const [removed, remove, removing] = useActionState(deleteUser, null);
  useActionTone(saved);
  useActionTone(reset);
  useActionTone(removed, "deleted", true);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (saved?.ok) setEditing(false);
  }, [saved]);

  return (
    <div className={`card flex flex-col gap-3 p-4 ${resetRequested ? "border-danger/50" : ""}`}>
      {!editing ? (
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold uppercase text-accent">
            {email[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{email}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {isAdmin ? (
                <span className="badge bg-accent-soft text-accent">{t("Administrator")}</span>
              ) : (
                perms.map((p) => (
                  <span key={p} className="badge border border-line bg-page text-muted">{t(permissionLabel(p))}</span>
                ))
              )}
              {!isAdmin && perms.length === 0 && <span className="badge border border-line bg-page text-muted">{t("No access")}</span>}
              {resetRequested && <span className="badge bg-danger text-white">{t("Reset requested")}</span>}
            </p>
            <p className="mt-1 text-xs text-muted">{t("Created")} {created}{isSelf ? ` · ${t("You")}` : ""}</p>
          </div>
        </div>
      ) : (
        <form action={save} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <div>
            <label htmlFor={`email-${id}`} className="label">{t("Email")}</label>
            <input id={`email-${id}`} name="email" type="email" defaultValue={email} required className="input" />
          </div>
          <PermissionPicker idPrefix={`edit-${id}`} options={ALL_PERMISSIONS} defaults={perms} adminAllowed adminDefault={isAdmin} lockAdmin={isSelf} />
          <div className="flex gap-2">
            <button disabled={saving} className="btn btn-primary">{saving ? t("Saving…") : t("Save")}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">{t("Cancel")}</button>
          </div>
        </form>
      )}

      {!editing && (canEdit || canReset || canDelete) && (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">{t("Edit")}</button>}
          {canReset && (
            <form action={doReset}>
              <input type="hidden" name="id" value={id} />
              <button disabled={resetting} className="btn btn-secondary btn-sm">{resetting ? t("Resetting…") : t("Reset password")}</button>
            </form>
          )}
          {canDelete && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger-ghost btn-sm ml-auto">{t("Delete")}</button>
          )}
          {canDelete && confirming && (
            <form action={remove} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <span className="text-xs text-muted">{t("Delete this user?")}</span>
              {/* The row disappears once the user is deleted, so the sound plays on the click itself. */}
              <button disabled={removing} onClick={() => void signal("deleted")} className="btn btn-danger btn-sm">{t("Yes, delete")}</button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">{t("Cancel")}</button>
            </form>
          )}
        </div>
      )}

      {saved?.error && <p role="alert" className="alert alert-error">{t(saved.error)}</p>}
      {removed?.error && <p role="alert" className="alert alert-error">{t(removed.error)}</p>}
      {reset?.error && <p role="alert" className="alert alert-error">{t(reset.error)}</p>}
      {reset?.code && (
        <div className="alert alert-success flex flex-col gap-2">
          <p>{t(reset.ok ?? "")}</p>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-surface px-2 py-1 font-mono text-base text-ink">{reset.code}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(reset.code!)} className="btn btn-secondary btn-sm">{t("Copy")}</button>
          </div>
          <p className="text-xs opacity-80">{t("Give this to the user. They must choose a new password when they sign in.")}</p>
        </div>
      )}
    </div>
  );
}
