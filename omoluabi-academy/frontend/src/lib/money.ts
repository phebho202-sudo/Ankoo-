import { INTL_LOCALE } from "./i18n/format";
import type { Locale } from "./i18n/dictionaries";

/** Minor units (kobo, cents) to a formatted amount, e.g. 250000 NGN -> "₦2,500.00". */
export function formatMoney(minor: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(minor / 100);
}

/** "2,500.50" -> 250050. Returns null for anything that is not a non-negative amount. */
export function toMinor(input: string): number | null {
  const clean = input.replace(/[,\s₦$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export const NUM = (v: number | string | null | undefined, empty = "–") => (v === null || v === undefined ? empty : String(v));
