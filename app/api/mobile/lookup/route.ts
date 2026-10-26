import { lookupVerification } from "@/lib/actions";
import { guard, isResponse, json, reply, readBody, toForm } from "@/lib/mobile";

// The monitor scans a 10-digit number and gets its verification code (404 when none is issued yet).
export async function POST(req: Request) {
  const me = await guard("monitor");
  if (isResponse(me)) return me;
  const { code } = await readBody<{ code?: string }>(req);
  const state = await lookupVerification(null, toForm({ code }));
  if (state?.error) return reply({ error: state.error, code: state.error.startsWith("No verification") ? "not_issued" : "invalid" }, state.error.startsWith("No verification") ? 404 : 400);
  return json({ ok: true, vcode: state?.vcode ?? null });
}
