import { requirePermission } from "@/lib/session";
import { sql } from "@/lib/db";
import { ALL_PERMISSIONS, canManageTarget, effectivePermissions } from "@/lib/permissions";
import { AutoRefresh } from "../../auto-refresh";
import { Shell } from "../../shell";
import { CreateUserForm, UserRow } from "./user-forms";

const when = (d: string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

export default async function UsersPage() {
  const me = await requirePermission("create_users", "reset_passwords", "remove_users");
  const users = await sql`
    SELECT u.id, u.email, u.role, u.permissions, u.created_at,
           EXISTS (SELECT 1 FROM reset_requests r WHERE r.user_id = u.id AND r.handled_at IS NULL) AS reset_requested
    FROM users u ORDER BY reset_requested DESC, u.email`;

  const canCreate = me.perms.includes("create_users");
  const canReset = me.perms.includes("reset_passwords");
  const canRemove = me.perms.includes("remove_users");

  return (
    <Shell title="Users" description="Create accounts and choose what each person may do." user={me} width="lg">
      <AutoRefresh seconds={10} />
      <div className={`grid items-start gap-6 ${canCreate ? "lg:grid-cols-[1fr_22rem]" : ""}`}>
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="font-semibold">All users <span className="font-normal text-muted">({users.length})</span></h2>
          {users.map((u) => {
            const target = { role: u.role as string, perms: effectivePermissions(u.role, u.permissions) };
            const manageable = canManageTarget(me, target);
            const isSelf = u.id === me.uid;
            return (
              <UserRow
                key={u.id}
                id={u.id}
                email={u.email}
                isAdmin={target.role === "admin"}
                perms={target.perms}
                isSelf={isSelf}
                resetRequested={canReset && u.reset_requested}
                created={when(u.created_at)}
                canEdit={me.isAdmin}
                canReset={canReset && manageable}
                canDelete={canRemove && manageable && !isSelf}
              />
            );
          })}
        </section>
        {canCreate && (
          <section className="card min-w-0 p-5 lg:sticky lg:top-20">
            <h2 className="mb-1 font-semibold">Add user</h2>
            <p className="mb-4 text-sm text-muted">They choose their own password when they first sign in.</p>
            <CreateUserForm options={me.isAdmin ? ALL_PERMISSIONS : me.perms} adminAllowed={me.isAdmin} />
          </section>
        )}
      </div>
    </Shell>
  );
}
