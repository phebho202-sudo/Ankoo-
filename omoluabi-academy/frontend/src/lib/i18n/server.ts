import "server-only";
import { cookies } from "next/headers";
import type { Dictionary, Locale } from "./dictionaries";
import { getDictionary, isLocale, LANG_COOKIE } from "./format";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
