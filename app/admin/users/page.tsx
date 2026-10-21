import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../../auto-refresh";
import { Header } from "../../header";
import { CreateUserForm, UserRow } from "./user-forms";

const when = (d: string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

export default async function UsersPage() {
  const me = await requireRole("admin");
  const users = await sql`
    SELECT u.id, u.email, u.role, u.created_at,
           EXISTS (SELECT 1 FROM reset_requests r WHERE r.user_id = u.id AND r.handled_at IS NULL) AS reset_requested
    FROM users u ORDER BY reset_requested DESC, u.email`;
  return (
    <>
      <Header title="Users" email={me.email} role={me.role} />
      <AutoRefresh seconds={10} />
      <main className="mx-auto grid max-w-4xl gap-10 p-4 sm:p-6 md:grid-cols-[1fr_18rem]">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">All users ({users.length})</h2>
          {users.map((u) => (
            <UserRow
              key={u.id}
              id={u.id}
              email={u.email}
              role={u.role}
              isSelf={u.id === me.uid}
              resetRequested={u.reset_requested}
              created={when(u.created_at)}
            />
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Create user</h2>
          <CreateUserForm />
        </section>
      </main>
    </>
  );
}
