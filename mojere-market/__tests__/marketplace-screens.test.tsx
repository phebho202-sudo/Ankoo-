import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ExploreScreen from '@/app/(tabs)/explore';
import ListingScreen from '@/app/listing/[id]';

import { mockRouter, setMockParams } from '../testing/expo-router-mock';
import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);

jest.mock('@/lib/supabase', () => {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'order', 'insert', 'delete', 'maybeSingle', 'upsert']) {
    chain[m] = jest.fn(() => chain);
  }
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(() => chain),
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    },
    checkSupabaseConnection: jest.fn(),
  };
});
const mockRpc = require('@/lib/supabase').supabase.rpc as jest.Mock;

const phone = {
  id: 'l1',
  title: 'iPhone 12 Pro 128GB',
  price_kobo: 25000000,
  is_negotiable: true,
  condition: 'like_new',
  status: 'active',
  published_at: new Date().toISOString(),
  category_slug: 'phones-tablets',
  category_name: 'Phones and tablets',
  lga_name: 'Akure South',
  town_name: 'Akure',
  neighbourhood: null,
  cover_path: null,
  seller_id: 's1',
  seller_name: 'Chidi',
  is_featured: false,
};

const detail = {
  ...phone,
  description: 'Clean, battery 89%',
  moderation_status: 'approved',
  created_at: new Date().toISOString(),
  view_count: null,
  category: { slug: 'phones-tablets', name: 'Phones and tablets' },
  images: [],
  seller: { id: 's1', display_name: 'Chidi', avatar_path: null, member_since: '2026-11-01T00:00:00Z', area: 'Akure' },
  is_own: false,
  is_favourite: false,
};

function rpcRespond(results: Record<string, unknown>) {
  mockRpc.mockImplementation(async (fn: string) => ({ data: results[fn] ?? null, error: null }));
}

beforeEach(() => {
  jest.clearAllMocks();
  setMockParams({});
});

describe('Explore', () => {
  it('shows listings from the database', async () => {
    rpcRespond({ mm_search_listings: [phone] });
    await renderScreen(<ExploreScreen />);
    expect(await screen.findByText('iPhone 12 Pro 128GB')).toBeTruthy();
    expect(screen.getByText('₦250,000')).toBeTruthy();
  });

  it('searches as you type', async () => {
    rpcRespond({ mm_search_listings: [] });
    await renderScreen(<ExploreScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search listings'), 'iphone');
    await waitFor(
      () =>
        expect(mockRpc).toHaveBeenCalledWith('mm_search_listings', expect.objectContaining({ p_query: 'iphone' })),
      { timeout: 2000 },
    );
  });

  it('opens the category from a Home screen link', async () => {
    setMockParams({ category: 'furniture' });
    rpcRespond({ mm_search_listings: [] });
    await renderScreen(<ExploreScreen />);
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('mm_search_listings', expect.objectContaining({ p_category_slug: 'furniture' })),
    );
  });

  it('shows a helpful empty state', async () => {
    rpcRespond({ mm_search_listings: [] });
    await renderScreen(<ExploreScreen />);
    expect(await screen.findByText('No listings yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sell an item' })).toBeTruthy();
  });

  it('opening a card goes to the product page', async () => {
    rpcRespond({ mm_search_listings: [phone] });
    await renderScreen(<ExploreScreen />);
    await fireEvent.press(await screen.findByLabelText(/iPhone 12 Pro 128GB/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/listing/[id]', params: { id: 'l1' } });
  });
});

describe('Product page', () => {
  beforeEach(() => setMockParams({ id: 'l1' }));

  it('shows the item, the seller and safety advice', async () => {
    rpcRespond({ mm_get_listing: detail, mm_verification_status: [{ email_verified: true, phone_verified: false }] });
    await renderScreen(<ListingScreen />);
    expect(await screen.findByText('₦250,000')).toBeTruthy();
    expect(screen.getByText('Negotiable')).toBeTruthy();
    expect(screen.getByText('Like new')).toBeTruthy();
    expect(screen.getByText('Chidi')).toBeTruthy();
    expect(screen.getByText('Stay safe when buying and selling')).toBeTruthy();
    expect(screen.getByText(/does not hold or protect payments/)).toBeTruthy();
    expect(await screen.findByText('Email verified')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('mm_record_listing_view', { p_listing_id: 'l1' });
  });

  it('asks logged-out visitors to log in before saving or reporting', async () => {
    rpcRespond({ mm_get_listing: detail, mm_verification_status: [] });
    await renderScreen(<ListingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save item' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-in');
    await fireEvent.press(screen.getByRole('button', { name: 'Report this listing' }));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
  });

  it('explains when an item is no longer available', async () => {
    rpcRespond({ mm_get_listing: null });
    await renderScreen(<ListingScreen />);
    expect(await screen.findByText('This item is no longer available')).toBeTruthy();
  });
});
