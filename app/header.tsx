import Link from "next/link";
import { logout } from "@/lib/actions";
import { sql } from "@/lib/db";
import { canManageUsers, homeFor, type Permission } from "@/lib/permissions";
import { Brand } from "./brand";
import { NavLink } from "./nav-link";

export async function Header({ email, perms }: { email: string; perms: Permission[] }) {
  let resets = 0;
  if (perms.includes("reset_passwords")) {
    const rows = await sql`SELECT count(*)::int AS n FROM reset_requests WHERE handled_at IS NULL`;
    resets = rows[0].n;
  }
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-6">
        <Link href={homeFor(perms)} aria-label="Home" className="shrink-0">
          <Brand />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:ml-4 sm:gap-1 [&::-webkit-scrollbar]:hidden">
          {perms.includes("manage_requests") && <NavLink href="/admin" exact>Requests</NavLink>}
          {perms.includes("request") && <NavLink href="/client" exact>Scan</NavLink>}
          {perms.includes("monitor") && <NavLink href="/monitor" exact>Monitor</NavLink>}
          {canManageUsers(perms) && (
            <NavLink href="/admin/users" exact>
              Users
              {resets > 0 && (
                <span className="badge ml-1.5 bg-danger text-white" title="Password reset requests waiting">{resets}</span>
              )}
            </NavLink>
          )}
          <NavLink href="/account" exact>Account</NavLink>
        </nav>
        <form action={logout} className="flex shrink-0 items-center gap-3">
          <span className="hidden max-w-48 truncate text-xs text-muted md:block">{email}</span>
          <button className="btn btn-secondary btn-sm">Log out</button>
        </form>
      </div>
    </header>
  );
}
