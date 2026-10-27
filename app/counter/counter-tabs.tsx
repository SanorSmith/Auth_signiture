import Link from "next/link";
import { getT } from "@/lib/lang";

// Count | Statistics, inside the Colli counter tab.
export async function CounterTabs({ current, isAdmin = false }: { current: "count" | "stats" | "rules"; isAdmin?: boolean }) {
  const t = await getT();
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-ink"}`;
  return (
    <div className="mb-4 flex gap-1">
      <Link href="/counter" className={tab(current === "count")}>{t("Count")}</Link>
      <Link href="/counter/dashboard" className={tab(current === "stats")}>{t("Statistics")}</Link>
      {isAdmin && <Link href="/counter/rules" className={tab(current === "rules")}>{t("Rules")}</Link>}
    </div>
  );
}
