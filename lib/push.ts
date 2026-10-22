import webpush from "web-push";
import { sql } from "./db";

type Vapid = { publicKey: string; privateKey: string };

let cached: Vapid | null = null;

// Signing keys for Web Push. Taken from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY when set, otherwise
// created once and kept in app_settings so no setup is needed.
async function vapid(): Promise<Vapid> {
  if (cached) return cached;
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (envPub && envPriv) return (cached = { publicKey: envPub, privateKey: envPriv });

  const read = async () => {
    const rows = await sql`SELECT key, value FROM app_settings WHERE key IN ('vapid_public', 'vapid_private')`;
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value as string]));
    return map.vapid_public && map.vapid_private ? { publicKey: map.vapid_public, privateKey: map.vapid_private } : null;
  };
  let keys = await read();
  if (!keys) {
    const fresh = webpush.generateVAPIDKeys();
    await sql`
      INSERT INTO app_settings (key, value) VALUES ('vapid_public', ${fresh.publicKey}), ('vapid_private', ${fresh.privateKey})
      ON CONFLICT (key) DO NOTHING`;
    keys = (await read()) ?? fresh; // another request may have won the race
  }
  return (cached = keys);
}

export const vapidPublicKey = async () => (await vapid()).publicKey;

export type PushPayload = { kind: string; title: string; body: string; url: string };

// Sends a notification to every device of the given users. Dead subscriptions (404/410) are removed.
export async function sendPushToUsers(userIds: number[], payload: PushPayload) {
  if (userIds.length === 0) return;
  const subs = await sql`
    SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY(${userIds}::int[])`;
  if (subs.length === 0) return;

  const keys = await vapid();
  const options = {
    TTL: 3600,
    urgency: "high" as const,
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT ?? "https://auth-signiture.vercel.app",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
  };
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, options);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
      }
    }),
  );
}
