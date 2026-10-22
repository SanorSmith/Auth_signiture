import { authenticate } from "@/lib/auth";
import { json, readBody } from "@/lib/mobile";
import { effectivePermissions } from "@/lib/permissions";
import { signToken } from "@/lib/session";

// The Android app signs in here and keeps the token it gets back (valid 30 days, and cancelled
// at once when the password is changed or reset, or the user is deleted).
export async function POST(req: Request) {
  const body = await readBody<{ email?: string; password?: string }>(req);
  const email = String(body.email ?? "").trim().toLowerCase();
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  const result = await authenticate(email, String(body.password ?? ""), ip);
  if ("error" in result) return json({ error: result.error }, result.error.startsWith("Too many") ? 429 : 401);

  const u = result.user;
  const token = await signToken({ uid: u.id, email, role: u.role, v: u.token_version }, "30d");
  return json({
    token,
    user: { id: u.id, email, isAdmin: u.role === "admin", perms: effectivePermissions(u.role, u.permissions), mustChange: u.must_change },
  });
}
