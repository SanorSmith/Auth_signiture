import { requireUser } from "@/lib/session";
import { Header } from "../header";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const s = await requireUser();
  return (
    <>
      <Header title="Change password" email={s.email} role={s.role} />
      <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
        {s.mustChange && (
          <p className="rounded border border-amber-500 p-3 text-sm text-amber-700 dark:text-amber-400">
            You need to choose a new password before you can continue.
          </p>
        )}
        <PasswordForm />
      </main>
    </>
  );
}
