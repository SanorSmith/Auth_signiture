import { requireRole } from "@/lib/session";
import { sql } from "@/lib/db";
import { AutoRefresh } from "../../auto-refresh";
import { Shell } from "../../shell";
import { CreateUserForm, UserRow } from "./user-forms";

const when = (d: string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

export default async function UsersPage() {
  const me = await requireRole("admin");
  const users = await sql`
    SELECT u.id, u.email, u.role, u.created_at,
           EXISTS (SELECT 1 FROM reset_requests r WHERE r.user_id = u.id AND r.handled_at IS NULL) AS reset_requested
    FROM users u ORDER BY reset_requested DESC, u.email`;
  return (
    <Shell title="Users" description="Create accounts, change roles and reset passwords." email={me.email} role={me.role} width="lg">
      <AutoRefresh seconds={10} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">All users <span className="font-normal text-muted">({users.length})</span></h2>
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
        <section className="card p-5 lg:sticky lg:top-20">
          <h2 className="mb-1 font-semibold">Add user</h2>
          <p className="mb-4 text-sm text-muted">They choose their own password when they first sign in.</p>
          <CreateUserForm />
        </section>
      </div>
    </Shell>
  );
}
