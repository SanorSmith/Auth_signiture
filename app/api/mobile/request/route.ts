import { requestVerification } from "@/lib/actions";
import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";

// A client scans a 10-digit number (with the supplier name and number of colli) to ask for its verification code.
export async function POST(req: Request) {
  const me = await guard("request");
  if (isResponse(me)) return me;
  const { code, supplier, colli } = await readBody<{ code?: string; supplier?: string; colli?: string | number }>(req);
  return fromState(await requestVerification(null, toForm({ code, supplier, colli })));
}
