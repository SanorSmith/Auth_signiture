import { requireRole } from "@/lib/session";
import { Header } from "../header";
import { Scanner } from "./scanner";

export default async function MonitorPage() {
  const s = await requireRole("monitor");
  return (
    <>
      <Header title="Monitor" email={s.email} />
      <Scanner />
    </>
  );
}
