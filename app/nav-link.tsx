"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
