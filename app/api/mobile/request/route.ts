import { requestVerification } from "@/lib/actions";
import { fromState, guard, isResponse, readBody, toForm } from "@/lib/mobile";

// A client scans a 10-digit number (with the supplier and how many pallets, bundles and boxes (older apps: one number and one type)) to ask for its verification code.
export async function POST(req: Request) {
  const me = await guard("request");
  if (isResponse(me)) return me;
  const b = await readBody<{ code?: string; supplier?: string; pallet?: number | string; bundle?: number | string; box?: number | string; colli?: string | number; colliType?: string }>(req);
  return fromState(await requestVerification(null, toForm({ code: b.code, supplier: b.supplier, pallet: b.pallet, bundle: b.bundle, box: b.box, colli: b.colli, colliType: b.colliType })));
}
