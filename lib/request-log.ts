import { sql } from "./db";

// A permanent log of what happens to code requests. A row is never changed or deleted: removing a request,
// an account or old codes leaves the log as it was, which is why people are kept as e-mail text, not as links.
export type RequestEvent = "requested" | "issued" | "denied" | "removed";

export async function logRequest(kind: RequestEvent, clientId: number | null, clientEmail: string | null, actorEmail: string | null) {
  try {
    await sql`INSERT INTO request_events (kind, client_id, client_email, actor_email) VALUES (${kind}, ${clientId}, ${clientEmail}, ${actorEmail})`;
  } catch (e) {
    // The log must never stop the request itself.
    console.error("request log failed", e);
  }
}
