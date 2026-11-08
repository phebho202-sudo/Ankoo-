import { toSearchParams } from '@/lib/listings';
import { timeAgo } from '@/lib/time';

describe('search parameters', () => {
  it('sends sensible defaults', () => {
    expect(toSearchParams({}, 0)).toEqual({
      p_query: null,
      p_category_slug: null,
      p_lga_id: null,
      p_min_kobo: null,
      p_max_kobo: null,
      p_conditions: null,
      p_sort: 'newest',
      p_featured_only: false,
      p_seller_id: null,
      p_limit: 20,
      p_offset: 0,
    });
  });

  it('maps filters and pages', () => {
    const p = toSearchParams(
      { query: '  iphone  ', categorySlug: 'phones-tablets', minKobo: 100000, conditions: ['good'], sort: 'price_asc' },
      2,
    );
    expect(p.p_query).toBe('iphone');
    expect(p.p_category_slug).toBe('phones-tablets');
    expect(p.p_min_kobo).toBe(100000);
    expect(p.p_conditions).toEqual(['good']);
    expect(p.p_sort).toBe('price_asc');
    expect(p.p_offset).toBe(40);
  });

  it('treats blank search and empty condition lists as "no filter"', () => {
    const p = toSearchParams({ query: '   ', conditions: [] }, 0);
    expect(p.p_query).toBeNull();
    expect(p.p_conditions).toBeNull();
  });

  it('limits very long search text', () => {
    expect(toSearchParams({ query: 'x'.repeat(500) }, 0).p_query).toHaveLength(100);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  it('describes recent times in plain words', () => {
    expect(timeAgo('2026-11-09T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-09T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-09T11:00:00Z', now)).toBe('1 hour ago');
    expect(timeAgo('2026-11-09T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-11-07T12:00:00Z', now)).toBe('2 days ago');
  });
  it('handles missing dates', () => {
    expect(timeAgo(null, now)).toBe('');
  });
});
