import Link from "next/link";
import { logout } from "@/lib/actions";
import { sql } from "@/lib/db";
import { getT } from "@/lib/lang";
import { canManageUsers, homeFor, type Permission } from "@/lib/permissions";
import { LangSwitch } from "./lang-switch";
import { NotificationCenter } from "./notification-center";
import { Brand } from "./brand";
import { BottomNav } from "./bottom-nav";
import { NavLink } from "./nav-link";

export async function Header({ email, perms }: { email: string; perms: Permission[] }) {
  const t = await getT();
  let resets = 0;
  if (perms.includes("reset_passwords")) {
    const rows = await sql`SELECT count(*)::int AS n FROM reset_requests WHERE handled_at IS NULL`;
    resets = rows[0].n;
  }
  // The bar along the bottom is a sibling of the header: the header's blur effect would otherwise trap it.
  return (
    <>
    <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-6">
        <Link href={homeFor(perms)} aria-label={t("Home")} className="shrink-0">
          <Brand />
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:flex [scrollbar-width:none] sm:ml-4 sm:gap-1 [&::-webkit-scrollbar]:hidden">
          {perms.includes("manage_requests") && <NavLink href="/admin" exact>{t("Requests")}</NavLink>}
          {perms.includes("request") && <NavLink href="/client" exact>{t("Scan")}</NavLink>}
          {perms.includes("monitor") && <NavLink href="/monitor" exact>{t("Monitor")}</NavLink>}
          {perms.includes("colli_counter") && <NavLink href="/counter">{t("Colli counter")}</NavLink>}
          {canManageUsers(perms) && (
            <NavLink href="/admin/users" exact>
              {t("Users")}
              {resets > 0 && (
                <span className="badge ml-1.5 bg-danger text-white" title={t("Password reset requests waiting")}>{resets}</span>
              )}
            </NavLink>
          )}
          <NavLink href="/account" exact>{t("Account")}</NavLink>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-3">
          <LangSwitch />
          <NotificationCenter perms={perms} />
          <span className="hidden max-w-48 truncate text-xs text-muted md:block">{email}</span>
          <form action={logout}>
            <button className="btn btn-secondary btn-sm">{t("Log out")}</button>
          </form>
        </div>
      </div>
    </header>
    <BottomNav perms={perms} resets={resets} />
    </>
  );
}
