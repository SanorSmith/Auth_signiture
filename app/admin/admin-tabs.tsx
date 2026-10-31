import Link from "next/link";
import { getT } from "@/lib/lang";

// Requests | Statistics, on the Requests page. Statistics are for administrators; everyone else sees no tabs.
export async function AdminTabs({ current, isAdmin }: { current: "requests" | "stats" | "allow"; isAdmin: boolean }) {
  if (!isAdmin) return null;
  const t = await getT();
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-ink"}`;
  return (
    <div className="mb-4 flex gap-1">
      <Link href="/admin" className={tab(current === "requests")}>{t("Requests")}</Link>
      <Link href="/admin/stats" className={tab(current === "stats")}>{t("Statistics")}</Link>
      <Link href="/admin/allow" className={tab(current === "allow")}>{t("Allow list")}</Link>
    </div>
  );
}
