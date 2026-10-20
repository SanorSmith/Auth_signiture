import { requireRole } from "@/lib/session";
import { Header } from "../header";
import { IssueForm, UserForm } from "./forms";

export default async function AdminPage() {
  const s = await requireRole("admin");
  return (
    <>
      <Header title="Admin" email={s.email} />
      <main className="mx-auto grid max-w-3xl gap-10 p-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Generate verification code</h2>
          <IssueForm />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Create user</h2>
          <UserForm />
        </section>
      </main>
    </>
  );
}
