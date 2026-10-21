import { requireRole } from "@/lib/session";
import { Shell } from "../shell";
import { Scanner } from "./scanner";

export default async function MonitorPage() {
  const s = await requireRole("monitor");
  return (
    <Shell title="Monitor" description="Scan or type a 10-digit number to show its verification code." email={s.email} role={s.role}>
      <Scanner />
    </Shell>
  );
}
