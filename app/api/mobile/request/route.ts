import { requestVerification } from "@/lib/actions";
import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";

// A client scans a 10-digit number (with the supplier, the number of colli and their type) to ask for its verification code.
export async function POST(req: Request) {
  const me = await guard("request");
  if (isResponse(me)) return me;
  const { code, supplier, colli, colliType } = await readBody<{ code?: string; supplier?: string; colli?: string | number; colliType?: string }>(req);
  return fromState(await requestVerification(null, toForm({ code, supplier, colli, colliType })));
}
