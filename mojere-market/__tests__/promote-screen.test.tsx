import { Platform } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import PromoteScreen from '@/app/promote/[id]';

import { setMockParams } from '../testing/expo-router-mock';
import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

jest.mock('@/lib/supabase', () => {
  const tables: Record<string, unknown> = {
    'listings:one': {
      id: 'l1', business_id: null, title: 'Standing fan', description: '', category_id: 'c', condition: 'good', price_kobo: 2500000,
      is_negotiable: true, lga_id: 'g', town_id: null, neighbourhood: null, status: 'active', moderation_status: 'approved',
      moderation_note: null, view_count: 3, created_at: '2026-11-09', published_at: '2026-11-09', listing_images: [],
    },
    promotion_packages: [
      { id: 'p1', code: 'featured_3d', name: 'Featured listing — 3 days', kind: 'featured', duration_days: 3, price_kobo: 50000 },
      { id: 'p2', code: 'featured_7d', name: 'Featured listing — 7 days', kind: 'featured', duration_days: 7, price_kobo: 100000 },
      { id: 'p4', code: 'assisted_listing', name: 'Assisted listing service', kind: 'assisted_listing', duration_days: null, price_kobo: 50000 },
    ],
    promotions: [],
  };
  const from = (name: string) => {
    const q: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'order']) q[op] = () => q;
    q.maybeSingle = async () => ({ data: tables[`${name}:one`] ?? null, error: null });
    q.then = (resolve: (v: unknown) => void) => resolve({ data: tables[name] ?? [], error: null });
    return q;
  };
  return {
    supabase: {
      from,
      rpc: jest.fn(async () => ({ data: 'promo-1', error: null })),
      functions: { invoke: jest.fn() },
      auth: {
        getSession: jest.fn(async () => ({ data: { session: { user: { id: 'u1' } } } })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    },
    checkSupabaseConnection: jest.fn(),
  };
});
const mockSupabase = require('@/lib/supabase').supabase;

beforeEach(() => {
  jest.clearAllMocks();
  setMockParams({ id: 'l1' });
});

it('shows promotion prices from the database (not the assisted service)', async () => {
  await renderScreen(<PromoteScreen />);
  expect(await screen.findByText('Featured listing — 3 days')).toBeTruthy();
  expect(screen.getByText('₦500')).toBeTruthy();
  expect(screen.getByText('₦1,000')).toBeTruthy();
  expect(screen.queryByText('Assisted listing service')).toBeNull();
});

it('is honest that payments are not switched on, and never charges', async () => {
  await renderScreen(<PromoteScreen />);
  expect(await screen.findByText('Online payments are not switched on yet')).toBeTruthy();
  await fireEvent.press(screen.getByText('Featured listing — 7 days'));
  await fireEvent.press(screen.getByRole('button', { name: 'Request promotion' }));
  await waitFor(() =>
    expect(mockSupabase.rpc).toHaveBeenCalledWith('mm_request_promotion', { p_listing_id: 'l1', p_package_code: 'featured_7d' }),
  );
  expect(await screen.findByText(/Online payment is not switched on yet, so an admin/)).toBeTruthy();
  expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
});

// Paid promotions are an Android-only feature (see paidFeaturesOnThisDevice).
beforeAll(() => {
  Platform.OS = 'android';
});
