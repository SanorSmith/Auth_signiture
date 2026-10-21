import Link from "next/link";
import { logout } from "@/lib/actions";
import { sql } from "@/lib/db";
import type { Role } from "@/lib/session";

const link = "rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800";

export async function Header({ title, email, role }: { title: string; email: string; role: Role }) {
  let resets = 0;
  if (role === "admin") {
    const rows = await sql`SELECT count(*)::int AS n FROM reset_requests WHERE handled_at IS NULL`;
    resets = rows[0].n;
  }
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        {role === "admin" && (
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className={link}>Requests</Link>
            <Link href="/admin/users" className={link}>
              Users
              {resets > 0 && (
                <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white" title="Password reset requests">{resets}</span>
              )}
            </Link>
          </nav>
        )}
      </div>
      <form action={logout} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="max-w-40 truncate text-neutral-500 sm:max-w-none">{email}</span>
        <Link href="/account" className={link}>Change password</Link>
        <button className="rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">Log out</button>
      </form>
    </header>
  );
}
