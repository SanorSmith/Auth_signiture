import Link from "next/link";
import { logout } from "@/lib/actions";
import { sql } from "@/lib/db";
import { homeFor, type Role } from "@/lib/session";
import { Brand } from "./brand";
import { NavLink } from "./nav-link";

const homeLabel: Record<Role, string> = { admin: "Requests", client: "Requests", monitor: "Monitor" };

export async function Header({ email, role }: { email: string; role: Role }) {
  let resets = 0;
  if (role === "admin") {
    const rows = await sql`SELECT count(*)::int AS n FROM reset_requests WHERE handled_at IS NULL`;
    resets = rows[0].n;
  }
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Link href={homeFor(role)} aria-label="Home" className="shrink-0">
          <Brand />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:ml-4 sm:gap-1 [&::-webkit-scrollbar]:hidden">
          <NavLink href={homeFor(role)} exact>{homeLabel[role]}</NavLink>
          {role === "admin" && (
            <NavLink href="/admin/users">
              Users
              {resets > 0 && (
                <span className="badge ml-1.5 bg-danger text-white" title="Password reset requests waiting">{resets}</span>
              )}
            </NavLink>
          )}
          <NavLink href="/account">Account</NavLink>
        </nav>
        <form action={logout} className="flex shrink-0 items-center gap-3">
          <span className="hidden max-w-48 truncate text-xs text-muted md:block">{email}</span>
          <button className="btn btn-secondary btn-sm">Log out</button>
        </form>
      </div>
    </header>
  );
}
