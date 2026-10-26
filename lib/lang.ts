import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, langFromHeader, makeT, type Lang } from "./i18n";

// The language for this request: what the person picked (cookie), else what the Android app sends in
// Accept-Language, else the browser's language. Swedish for Swedish speakers, English otherwise.
export async function getLang(): Promise<Lang> {
  const picked = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(picked)) return picked;
  return langFromHeader((await headers()).get("accept-language"));
}

export async function getT() {
  return makeT(await getLang());
}
