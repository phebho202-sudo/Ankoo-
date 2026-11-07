/**
 * Prices are stored in the database as whole kobo (integers) to avoid
 * rounding errors. ₦1 = 100 kobo.
 */

/** Format a kobo amount as Naira, e.g. 150000 → "₦1,500". */
export function formatNaira(kobo: number): string {
  if (!Number.isFinite(kobo)) return '₦—';
  const naira = kobo / 100;
  const hasKobo = Math.round(kobo) % 100 !== 0;
  const formatted = naira.toLocaleString('en-NG', {
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `₦${formatted}`;
}

/**
 * Turn what a user typed ("1,500", "₦ 2500", "3500.50") into kobo.
 * Returns null if the text is not a valid non-negative amount.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '').replace(/^NGN/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const kobo = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(kobo) ? kobo : null;
}
