import { sql } from "@/lib/db";
import { guard, isResponse, json } from "@/lib/mobile";
import { ALL_PERMISSIONS, canManageTarget, effectivePermissions } from "@/lib/permissions";

// The users screen: everyone with their permissions, which actions the signed-in person may take on
// each, and what they may hand out when creating an account.
export async function GET() {
  const me = await guard("create_users", "reset_passwords", "remove_users");
  if (isResponse(me)) return me;

  const rows = await sql`
    SELECT u.id, u.email, u.role, u.permissions, u.created_at,
           EXISTS (SELECT 1 FROM reset_requests r WHERE r.user_id = u.id AND r.handled_at IS NULL) AS reset_requested
    FROM users u ORDER BY reset_requested DESC, u.email`;

  const canReset = me.perms.includes("reset_passwords");
  const canRemove = me.perms.includes("remove_users");

  return json({
    canCreate: me.perms.includes("create_users"),
    adminAllowed: me.isAdmin,
    grantable: me.isAdmin ? ALL_PERMISSIONS : me.perms,
    users: rows.map((u) => {
      const target = { role: u.role as string, perms: effectivePermissions(u.role as string, u.permissions as string[]) };
      const manageable = canManageTarget(me, target);
      const isSelf = u.id === me.uid;
      return {
        id: u.id as number,
        email: u.email as string,
        isAdmin: target.role === "admin",
        perms: target.perms,
        isSelf,
        resetRequested: canReset && (u.reset_requested as boolean),
        createdAt: new Date(u.created_at as string).getTime(),
        canEdit: me.isAdmin,
        canReset: canReset && manageable,
        canDelete: canRemove && manageable && !isSelf,
      };
    }),
  });
}
