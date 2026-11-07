import { INITIAL_CATEGORIES, CONDITIONS } from '@/constants/catalog';
import { ONDO_LGAS } from '@/constants/ondo';

describe('Ondo State locations', () => {
  it('lists all 18 LGAs exactly once', () => {
    expect(ONDO_LGAS).toHaveLength(18);
    expect(new Set(ONDO_LGAS.map((l) => l.slug)).size).toBe(18);
    expect(ONDO_LGAS.map((l) => l.name)).toEqual(
      expect.arrayContaining(['Akure South', 'Akure North', 'Owo', 'Ile Oluji/Okeigbo', 'Ese Odo']),
    );
  });
});

describe('catalog', () => {
  it('has the 13 initial categories with unique slugs', () => {
    expect(INITIAL_CATEGORIES).toHaveLength(13);
    expect(new Set(INITIAL_CATEGORIES.map((c) => c.slug)).size).toBe(13);
  });
  it('has the 5 listing conditions', () => {
    expect(CONDITIONS.map((c) => c.label)).toEqual([
      'Brand new', 'Like new', 'Good', 'Fair', 'For parts or repair',
    ]);
  });
});
