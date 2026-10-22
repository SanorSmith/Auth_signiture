import { after } from "next/server";
import { sql } from "./db";
import { sendPushToUsers } from "./push";

// Runs after the response is sent, so the person never waits for it, and a failed notification
// can never make the action itself fail.
export function later(work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
    } catch {
      // Nothing to do: the action already succeeded.
    }
  });
}

// Everything one person can be told about something another person did.
export type NotifyKind =
  | "new_request" // a client asked for a code            -> people who manage requests
  | "code_issued" // the admin issued the client's code   -> the client
  | "request_denied" // the admin denied the request      -> the client
  | "request_removed" // the admin removed the request    -> the client
  | "reset_requested" // someone forgot their password    -> people who reset passwords
  | "access_changed"; // an admin changed a user's access -> that user

export type Notice = { kind: NotifyKind; title: string; body: string; url: string };

const KEEP_PER_USER = 50;

// Saves the notification for each recipient (the app shows it with its tone) and sends it to
// their devices, so they hear about it even when the app is closed.
export async function notifyUsers(userIds: number[], notice: Notice) {
  const ids = [...new Set(userIds)].filter((n) => Number.isInteger(n));
  if (ids.length === 0) return;
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, url)
    SELECT u, ${notice.kind}, ${notice.title}, ${notice.body}, ${notice.url} FROM unnest(${ids}::int[]) AS u`;
  // Keep only the newest few per person.
  await sql`
    DELETE FROM notifications n USING (
      SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY id DESC) AS rn
      FROM notifications WHERE user_id = ANY(${ids}::int[])
    ) old
    WHERE n.id = old.id AND old.rn > ${KEEP_PER_USER}`;
  await sendPushToUsers(ids, notice);
}

// Notifies everyone who holds a permission (administrators hold all), except `exceptUserId`.
export async function notifyPermission(permission: "manage_requests" | "reset_passwords", notice: Notice, exceptUserId: number | null) {
  const rows = await sql`
    SELECT id FROM users
    WHERE (role = 'admin' OR ${permission} = ANY(permissions))
      AND (${exceptUserId}::int IS NULL OR id <> ${exceptUserId}::int)`;
  await notifyUsers(rows.map((r) => r.id as number), notice);
}
