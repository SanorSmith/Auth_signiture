import { requestVerification } from "@/lib/actions";
import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";

// A client scans a 10-digit number (with an optional note) to ask for its verification code.
export async function POST(req: Request) {
  const me = await guard("request");
  if (isResponse(me)) return me;
  const { code, note } = await readBody<{ code?: string; note?: string }>(req);
  return fromState(await requestVerification(null, toForm({ code, note })));
}
