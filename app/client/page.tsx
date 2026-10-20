import { requireRole } from "@/lib/session";
import { Header } from "../header";
import { CodeGenerator } from "./generator";

export default async function ClientPage() {
  const s = await requireRole("client");
  return (
    <>
      <Header title="My code" email={s.email} />
      <main className="mx-auto max-w-md p-6">
        <CodeGenerator />
      </main>
    </>
  );
}
