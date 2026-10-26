import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, makeT, type Lang } from "./i18n";

// The language for this request: what the person picked (cookie); for the Android app, the plain
// "sv" or "en" it sends in Accept-Language; otherwise Swedish, which is the default for everyone.
export async function getLang(): Promise<Lang> {
  const picked = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(picked)) return picked;
  const accept = (await headers()).get("accept-language")?.trim().toLowerCase();
  if (accept === "en" || accept === "sv") return accept;
  return "sv";
}

export async function getT() {
  return makeT(await getLang());
}
