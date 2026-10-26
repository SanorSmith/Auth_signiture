import { getT } from "@/lib/lang";
import { requireUser } from "@/lib/session";
import { Shell } from "../shell";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const s = await requireUser();
  const t = await getT();
  return (
    <Shell title="Account" description="Change the password you use to sign in." user={s} width="sm">
      {s.mustChange && (
        <p role="alert" className="alert alert-warn mb-4">{t("You need to choose a new password before you can continue.")}</p>
      )}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">{t("Change password")}</h2>
        <PasswordForm />
      </section>
    </Shell>
  );
}
