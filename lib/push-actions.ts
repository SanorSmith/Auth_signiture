"use server";

import { sql } from "./db";
import { vapidPublicKey } from "./push";
import { requirePermission } from "./session";

// Called by the browser when an admin turns on device notifications.
export async function getPushKey() {
  await requirePermission("manage_requests");
  return vapidPublicKey();
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string) {
  const me = await requirePermission("manage_requests");
  if (!sub.endpoint.startsWith("https://") || !sub.p256dh || !sub.auth) return { error: "Invalid subscription" };
  // One row per device; if the device now belongs to a different person, it moves to them.
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${me.uid}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${userAgent.slice(0, 200)})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = ${me.uid}, p256dh = ${sub.p256dh}, auth = ${sub.auth}`;
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const me = await requirePermission("manage_requests");
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${me.uid}`;
  return { ok: true };
}
