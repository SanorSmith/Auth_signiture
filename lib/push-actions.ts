"use server";

import { sql } from "./db";
import { vapidPublicKey } from "./push";
import { requireUser } from "./session";

// Called by the browser when someone turns on device notifications. Everyone may: clients hear
// about their codes, admins about new requests.
export async function getPushKey() {
  await requireUser();
  return vapidPublicKey();
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string) {
  const me = await requireUser();
  if (!sub.endpoint.startsWith("https://") || !sub.p256dh || !sub.auth) return { error: "Invalid subscription" };
  // One row per device; if the device now belongs to a different person, it moves to them.
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${me.uid}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${userAgent.slice(0, 200)})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = ${me.uid}, p256dh = ${sub.p256dh}, auth = ${sub.auth}`;
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const me = await requireUser();
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${me.uid}`;
  return { ok: true };
}

// Marks everything the person has been told about as read.
export async function markNotificationsRead() {
  const me = await requireUser();
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${me.uid} AND read_at IS NULL`;
  return { ok: true };
}
