import { dictionaries, type Dictionary, type Locale } from "./dictionaries";

export const LANG_COOKIE = "omoluabi_lang";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "yo";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replace {name} placeholders. Unknown placeholders are left visible so mistakes are noticed. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const INTL_LOCALE: Record<Locale, string> = { en: "en-NG", yo: "yo-NG" };

export function formatDateTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (locale === "yo") {
    // Runtime Yoruba locale data has no month names (it prints "14 11 2026"), so use an
    // unambiguous day/month/year format, as commonly written in Nigeria.
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    }).format(date);
  }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export function formatUsd(amount: string | number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}
