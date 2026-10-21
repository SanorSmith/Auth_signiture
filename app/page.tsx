import { redirect } from "next/navigation";
import { homeFor } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function Home() {
  const s = await requireUser();
  redirect(s.mustChange ? "/account" : homeFor(s.perms));
}
