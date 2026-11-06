'use strict';
// Tax helpers for Nigerian small businesses under the Nigeria Tax Act 2025
// (effective 1 January 2026). These are ESTIMATES to help owners prepare;
// they are not tax advice. Thresholds are configurable because published
// guides disagree on the small-company turnover limit (₦50m vs ₦100m).

const KOBO = 100;

// Personal income tax bands (annual taxable income, naira) from 2026.
const PIT_BANDS = [
  { upTo: 800_000, rate: 0 },
  { upTo: 3_000_000, rate: 0.15 },
  { upTo: 12_000_000, rate: 0.18 },
  { upTo: 25_000_000, rate: 0.21 },
  { upTo: 50_000_000, rate: 0.23 },
  { upTo: Infinity, rate: 0.25 },
];

function thresholds(env = process.env) {
  return {
    smallCompanyTurnover: Number(env.SMALL_COMPANY_TURNOVER_NGN || 100_000_000),
    smallCompanyFixedAssets: Number(env.SMALL_COMPANY_FIXED_ASSETS_NGN || 250_000_000),
    pitZeroBand: 800_000,
  };
}

// Estimated personal income tax (naira) on a profit figure (naira).
function estimatePIT(profitNaira) {
  let remaining = Math.max(0, profitNaira);
  let lower = 0;
  let tax = 0;
  for (const band of PIT_BANDS) {
    if (remaining <= 0) break;
    const width = band.upTo - lower;
    const slice = Math.min(remaining, width);
    tax += slice * band.rate;
    remaining -= slice;
    lower = band.upTo;
  }
  return Math.round(tax);
}

// entries: [{ kind: 'sale'|'expense', amount_kobo, date: 'YYYY-MM-DD' }]
function summarise(entries) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sales: 0, expenses: 0 }));
  let sales = 0;
  let expenses = 0;
  for (const e of entries) {
    const m = Number(String(e.date).slice(5, 7)) - 1;
    const amt = e.amount_kobo / KOBO;
    if (e.kind === 'sale') {
      sales += amt;
      if (months[m]) months[m].sales += amt;
    } else {
      expenses += amt;
      if (months[m]) months[m].expenses += amt;
    }
  }
  return { sales, expenses, profit: sales - expenses, months };
}

// profile: { business_type: 'individual'|'company', fixed_assets_kobo, professional_services }
function assess(entries, profile = {}, env = process.env) {
  const t = thresholds(env);
  const s = summarise(entries);
  const fixedAssets = (profile.fixed_assets_kobo || 0) / KOBO;
  const result = { ...s, thresholds: t, businessType: profile.business_type || 'individual', notes: [] };

  if (result.businessType === 'company') {
    const turnoverOk = s.sales <= t.smallCompanyTurnover;
    const assetsOk = fixedAssets < t.smallCompanyFixedAssets;
    const prof = Boolean(profile.professional_services);
    result.smallCompany = turnoverOk && assetsOk && !prof;
    result.turnoverUsedPct = Math.min(100, Math.round((s.sales / t.smallCompanyTurnover) * 100));
    result.estimatedTax = null;
    if (result.smallCompany) {
      result.notes.push('Likely qualifies as a SMALL COMPANY: 0% Companies Income Tax, exempt from Capital Gains Tax and the Development Levy. You must still file returns and keep records.');
    } else {
      if (!turnoverOk) result.notes.push('Turnover is above the small-company limit.');
      if (!assetsOk) result.notes.push('Fixed assets are at or above the small-company limit.');
      if (prof) result.notes.push('Professional service businesses are excluded from small-company relief.');
      result.notes.push('Company is likely liable to Companies Income Tax. Speak to a chartered accountant.');
    }
  } else {
    result.estimatedTax = estimatePIT(s.profit);
    result.turnoverUsedPct = null;
    if (s.profit <= t.pitZeroBand) {
      result.notes.push('Profit is within the ₦800,000 tax-free band: estimated personal income tax is ₦0. Keep these records as proof.');
    } else {
      result.notes.push('Profit is above the ₦800,000 tax-free band. Estimate uses the 2026 progressive bands (15%–25%) before reliefs such as rent relief or pension.');
    }
  }
  result.notes.push('Nigeria Tax Administration Act: every business, taxable or not, must keep books and records for at least 6 years.');
  return result;
}

module.exports = { estimatePIT, summarise, assess, thresholds, PIT_BANDS, KOBO };
