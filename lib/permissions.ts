// What a user may do. An administrator has all of these and is the only one who edits permissions.
export const PERMISSIONS = [
  { key: "request", label: "Request codes", hint: "Scan numbers and see their codes" },
  { key: "monitor", label: "Monitor", hint: "Look up a code by scanning its number" },
  { key: "manage_requests", label: "Manage requests", hint: "Generate, deny and remove requests" },
  { key: "create_users", label: "Create accounts", hint: "Add new users" },
  { key: "reset_passwords", label: "Reset passwords", hint: "Not for administrators or other user managers" },
  { key: "remove_users", label: "Remove accounts", hint: "Not for administrators or other user managers" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map((p) => p.key);
export const permissionLabel = (key: string) => PERMISSIONS.find((p) => p.key === key)?.label ?? key;

const VALID = new Set<string>(ALL_PERMISSIONS);
export const parsePermissions = (values: unknown[]): Permission[] =>
  [...new Set(values.map(String))].filter((v): v is Permission => VALID.has(v));

// Effective permissions: administrators have everything; the older client and monitor roles keep their access.
export function effectivePermissions(role: string, stored: string[] | null): Permission[] {
  if (role === "admin") return ALL_PERMISSIONS;
  const set = new Set(parsePermissions(stored ?? []));
  if (role === "client") set.add("request");
  if (role === "monitor") set.add("monitor");
  return [...set];
}

const USER_PERMISSIONS: Permission[] = ["create_users", "reset_passwords", "remove_users"];
export const canManageUsers = (perms: Permission[]) => perms.some((p) => USER_PERMISSIONS.includes(p));

// The first screen a user may open.
export function homeFor(perms: Permission[]) {
  if (perms.includes("manage_requests")) return "/admin";
  if (perms.includes("request")) return "/client";
  if (perms.includes("monitor")) return "/monitor";
  if (canManageUsers(perms)) return "/admin/users";
  return "/account";
}

// May the actor reset or remove this user? Administrators may anyone. Everyone else may not touch
// administrators or other user managers, so resetting a password can never lead to account-management power.
export function canManageTarget(
  actor: { isAdmin: boolean },
  target: { role: string; perms: Permission[] },
) {
  if (actor.isAdmin) return true;
  return target.role !== "admin" && !canManageUsers(target.perms);
}
