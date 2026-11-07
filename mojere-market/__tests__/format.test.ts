import { formatNaira, parseNairaToKobo } from '@/lib/format';

describe('formatNaira', () => {
  it('formats whole Naira with thousands separators', () => {
    expect(formatNaira(150000)).toBe('₦1,500');
    expect(formatNaira(100000000)).toBe('₦1,000,000');
    expect(formatNaira(0)).toBe('₦0');
  });
  it('shows kobo only when present', () => {
    expect(formatNaira(150050)).toBe('₦1,500.50');
  });
  it('handles bad input safely', () => {
    expect(formatNaira(Number.NaN)).toBe('₦—');
  });
});

describe('parseNairaToKobo', () => {
  it('accepts common ways people type prices', () => {
    expect(parseNairaToKobo('1,500')).toBe(150000);
    expect(parseNairaToKobo('₦ 2500')).toBe(250000);
    expect(parseNairaToKobo('3500.50')).toBe(350050);
  });
  it('rejects invalid or negative amounts', () => {
    expect(parseNairaToKobo('')).toBeNull();
    expect(parseNairaToKobo('-200')).toBeNull();
    expect(parseNairaToKobo('abc')).toBeNull();
    expect(parseNairaToKobo('1.234')).toBeNull();
  });
});
