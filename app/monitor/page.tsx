import { requirePermission } from "@/lib/session";
import { Shell } from "../shell";
import { Scanner } from "./scanner";

export default async function MonitorPage() {
  const s = await requirePermission("monitor");
  return (
    <Shell title="Monitor" description="Scan or type a 10-digit number to show its verification code." user={s}>
      <Scanner />
    </Shell>
  );
}
