import { splitPublishable, type DeclutterItem } from '@/lib/declutter';
import { missingForPublish, saveListing } from '@/lib/selling';
import { listingSchema } from '@/lib/validation';

jest.mock('@/lib/photos', () => ({
  uploadListingPhoto: jest.fn(async (userId: string, uri: string) => ({ path: `${userId}/${uri}.jpg`, width: 1280, height: 960 })),
  removeListingPhotos: jest.fn(async () => undefined),
}));

// A stand-in database that records every call in order.
const mockCalls: string[] = [];
let mockFailOn: string | null = null;
function mockTable(name: string) {
  const q: Record<string, unknown> = {};
  const rec = (op: string) => (...args: unknown[]) => {
    mockCalls.push(`${name}.${op}${op === 'update' || op === 'insert' ? ':' + JSON.stringify(args[0]) : ''}`);
    return q;
  };
  for (const op of ['insert', 'update', 'delete', 'select', 'eq', 'in']) q[op] = rec(op);
  q.single = async () => ({ data: { id: 'new-listing' }, error: null });
  q.then = (resolve: (v: unknown) => void) => {
    const failed = mockFailOn && mockCalls[mockCalls.length - 1]?.startsWith(mockFailOn);
    resolve({ data: name === 'listing_images' ? [{ storage_path: 'u1/old.jpg' }] : [], error: failed ? { message: 'boom' } : null });
  };
  return q;
}
jest.mock('@/lib/supabase', () => ({ supabase: { from: (n: string) => mockTable(n) } }));

const values = {
  title: 'Wooden study table',
  description: 'Solid',
  categoryId: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a10',
  condition: 'good' as const,
  priceKobo: 1500000,
  isNegotiable: true,
  lgaId: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a11',
  townId: null,
  neighbourhood: '',
};

beforeEach(() => {
  mockCalls.length = 0;
  mockFailOn = null;
});

describe('saveListing', () => {
  it('saves a draft first, uploads photos, then publishes', async () => {
    const id = await saveListing({ userId: 'u1', values, photos: [{ key: 'a', uri: 'pic1' }], publish: true });
    expect(id).toBe('new-listing');
    const firstInsert = mockCalls.findIndex((c) => c.startsWith('listings.insert'));
    const imageInsert = mockCalls.findIndex((c) => c.startsWith('listing_images.insert'));
    const publish = mockCalls.findIndex((c) => c === 'listings.update:{"status":"active"}');
    expect(mockCalls[firstInsert]).toContain('"status":"draft"');
    expect(firstInsert).toBeLessThan(imageInsert);
    expect(imageInsert).toBeLessThan(publish);
    expect(mockCalls[imageInsert]).toContain('u1/pic1.jpg');
  });

  it('does not publish when asked to save a draft', async () => {
    await saveListing({ userId: 'u1', values, photos: [], publish: false });
    expect(mockCalls.some((c) => c === 'listings.update:{"status":"active"}')).toBe(false);
  });

  it('stops before publishing if saving photos fails', async () => {
    mockFailOn = 'listing_images.insert';
    await expect(
      saveListing({ userId: 'u1', values, photos: [{ key: 'a', uri: 'pic1' }], publish: true }),
    ).rejects.toBeTruthy();
    expect(mockCalls.some((c) => c === 'listings.update:{"status":"active"}')).toBe(false);
  });

  it('removes photos the seller took out of an existing listing', async () => {
    const { removeListingPhotos } = jest.requireMock('@/lib/photos');
    await saveListing({ userId: 'u1', listingId: 'l1', values, photos: [{ key: 'b', path: 'u1/kept.jpg' }], publish: false });
    expect(removeListingPhotos).toHaveBeenCalledWith(['u1/old.jpg']);
  });
});

describe('listing form rules', () => {
  const good = {
    title: 'Wooden study table',
    description: '',
    categoryId: values.categoryId,
    condition: 'good',
    price: '15,000',
    isNegotiable: true,
    lgaId: values.lgaId,
    townId: null,
    neighbourhood: '',
  };
  it('accepts a complete listing', () => {
    expect(listingSchema.safeParse(good).success).toBe(true);
  });
  it('rejects missing or invalid fields with clear messages', () => {
    const r = listingSchema.safeParse({ ...good, title: 'ab', price: 'abc', categoryId: '' });
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages.join(' ')).toMatch(/short title/);
    expect(messages.join(' ')).toMatch(/price as a number/);
    expect(messages.join(' ')).toMatch(/category/);
  });
  it('allows free items but caps very high prices', () => {
    expect(listingSchema.safeParse({ ...good, price: '0' }).success).toBe(true);
    expect(listingSchema.safeParse({ ...good, price: '200000000' }).success).toBe(false);
  });
});

describe('publishing rules', () => {
  it('requires a photo before publishing', () => {
    expect(missingForPublish({ title: 'Table', categoryId: 'c', lgaId: 'l', photoCount: 0 })).toEqual(['at least one photo']);
    expect(missingForPublish({ title: 'Table', categoryId: 'c', lgaId: 'l', photoCount: 1 })).toEqual([]);
  });

  it('only offers complete drafts for publishing in Declutter My Home', () => {
    const base: DeclutterItem = {
      id: '1', title: 'Lamp', price_kobo: 300000, status: 'draft', moderation_status: 'approved',
      category_id: 'c', lga_id: 'l', listing_images: [{ storage_path: 'u/1.jpg', position: 0 }],
    };
    const { ready, incomplete } = splitPublishable([
      base,
      { ...base, id: '2', listing_images: [] },
      { ...base, id: '3', status: 'active' },
    ]);
    expect(ready.map((i) => i.id)).toEqual(['1']);
    expect(incomplete.map((i) => i.id)).toEqual(['2']);
  });
});
