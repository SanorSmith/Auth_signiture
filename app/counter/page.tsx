import { counterState } from "@/lib/counter";
import { requirePermission } from "@/lib/session";
import { Shell } from "../shell";
import { CounterPanel } from "./counter-panel";
import { CounterTabs } from "./counter-tabs";

export default async function CounterPage() {
  const s = await requirePermission("colli_counter");
  const initial = await counterState(s.uid);
  return (
    <Shell title="Colli counter" description="Scan each package of one shipment. The package codes are deleted when you finish; only the number is saved." user={s}>
      <CounterTabs current="count" isAdmin={s.isAdmin} />
      <CounterPanel initial={initial} />
    </Shell>
  );
}
