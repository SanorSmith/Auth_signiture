"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { canManageUsers, type Permission } from "@/lib/permissions";
import { useLang, useT } from "./lang-provider";

// The main tabs along the bottom edge on small screens, where the thumb is. On larger screens the
// tabs stay in the top bar. Only the screens the person may use are shown.

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  requests: icon(<><path d="M4 13l2.5-7h11L20 13" /><path d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5h-5l-1 2h-4l-1-2H4Z" /></>),
  scan: icon(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 9v6M12 9v6M16 9v6" /></>),
  monitor: icon(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>),
  counter: icon(<><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>),
  users: icon(<><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2c2 .6 3.5 2.2 3.5 4.8" /></>),
  account: icon(<><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></>),
};

type Item = { href: string; label: string; exact: boolean; icon: ReactNode; badge?: number };

export function BottomNav({ perms, resets }: { perms: Permission[]; resets: number }) {
  const t = useT();
  const lang = useLang();
  const path = usePathname();

  const items: Item[] = [];
  if (perms.includes("manage_requests")) items.push({ href: "/admin", label: lang === "sv" ? "Inkorg" : t("Requests"), exact: true, icon: ICONS.requests });
  if (perms.includes("request")) items.push({ href: "/client", label: t("Scan"), exact: true, icon: ICONS.scan });
  if (perms.includes("monitor")) items.push({ href: "/monitor", label: t("Monitor"), exact: true, icon: ICONS.monitor });
  if (perms.includes("colli_counter")) items.push({ href: "/counter", label: t("Counter"), exact: false, icon: ICONS.counter });
  if (canManageUsers(perms)) items.push({ href: "/admin/users", label: t("Users"), exact: true, icon: ICONS.users, badge: resets });
  items.push({ href: "/account", label: t("Account"), exact: true, icon: ICONS.account });

  return (
    <nav
      aria-label={t("Main menu")}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch">
        {items.map((it) => {
          const active = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
          return (
            <li key={it.href} className="min-w-0 flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 px-0 text-[9px] font-medium leading-none transition min-[360px]:text-[10px] ${
                  active ? "text-accent" : "text-muted active:bg-page"
                }`}
              >
                {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-accent" />}
                <span className="relative">
                  {it.icon}
                  {it.badge ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">{it.badge}</span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
