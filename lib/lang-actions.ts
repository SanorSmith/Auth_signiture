"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { LANG_COOKIE, isLang } from "./i18n";
import { getSession } from "./session";

// Switches the language: remembered in a cookie for this device, and on the account so that
// notifications sent to the person's devices use it too.
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const s = await getSession();
  if (s) await sql`UPDATE users SET lang = ${lang} WHERE id = ${s.uid}`;
  revalidatePath("/", "layout");
}
