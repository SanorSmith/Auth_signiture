import { getT } from "@/lib/lang";
import { listAllowed } from "@/lib/allow-list";
import { requireAdmin } from "@/lib/session";
import { Shell } from "../../shell";
import { AdminTabs } from "../admin-tabs";
import { AddSupplier, RemoveSupplier } from "./allow-forms";

const when = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

export default async function AllowListPage() {
  const s = await requireAdmin();
  const t = await getT();
  const list = await listAllowed();
  return (
    <Shell title="Requests" description="Suppliers on this list get their code at once, without you confirming each request. The request still shows in the history, and you can remove it there." user={s} width="lg">
      <AdminTabs current="allow" isAdmin={s.isAdmin} />
      <div className="flex flex-col gap-4">
        <AddSupplier />
        <p className="text-xs text-muted">{t("A request is accepted when one word of its supplier name is a word in a name on the list. Capital letters do not matter, and AB, GmbH and similar do not count as a word.")}</p>
        <section className="card divide-y divide-line">
          {list.length === 0 && <p className="p-6 text-center text-sm text-muted">{t("No suppliers on the list. Every request waits for you.")}</p>}
          {list.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{x.name}</p>
                <p className="truncate text-xs text-muted">{t("Added")} {when(x.at)}{x.addedBy ? ` · ${x.addedBy}` : ""}</p>
              </div>
              <RemoveSupplier id={x.id} />
            </div>
          ))}
        </section>
      </div>
    </Shell>
  );
}
