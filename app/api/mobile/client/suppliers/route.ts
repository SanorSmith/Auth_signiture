import { guard, isResponse, json } from "@/lib/mobile";
import { supplierSuggestions } from "@/lib/suppliers";

// Supplier names to suggest while a request is filled in.
export async function GET() {
  const me = await guard("request");
  if (isResponse(me)) return me;
  return json({ suppliers: await supplierSuggestions(me.uid) });
}
