import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import AdminHome from '@/app/admin/index';
import AdminListingsScreen from '@/app/admin/listings';
import GuidelinesScreen from '@/app/guidelines';

import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => require('../testing/expo-router-mock').expoRouterMock);

const mockState = { staff: false, admin: false };

jest.mock('@/lib/supabase', () => {
  const pending = [
    {
      id: 'l9', title: 'Suspicious iPhone 15', price_kobo: 5000000, status: 'active', moderation_status: 'pending',
      moderation_note: null, created_at: new Date().toISOString(), seller_id: 's9', seller: { display_name: 'Seller Nine' }, listing_images: [],
    },
  ];
  const from = () => {
    const q: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'neq', 'in', 'order', 'limit']) q[op] = () => q;
    q.then = (resolve: (v: unknown) => void) => resolve({ data: pending, error: null });
    return q;
  };
  return {
    supabase: {
      from,
      rpc: jest.fn(async (fn: string) => {
        if (fn === 'mm_is_staff') return { data: mockState.staff, error: null };
        if (fn === 'mm_is_admin') return { data: mockState.admin, error: null };
        if (fn === 'mm_admin_stats')
          return {
            data: {
              users: 42, new_users_7d: 5, suspended_users: 1, active_listings: 30, new_listings_7d: 9, pending_review: 1,
              sold_listings: 4, confirmed_sales: 3, open_reports: 2, conversations: 12, businesses: 2, active_promotions: 1,
              pending_promotions: 1, revenue_kobo: 150000, revenue_30d_kobo: 100000,
            },
            error: null,
          };
        return { data: null, error: null };
      }),
      auth: {
        getSession: jest.fn(async () => ({ data: { session: { user: { id: 'u-admin' } } } })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    },
    checkSupabaseConnection: jest.fn(),
  };
});
const mockRpc = require('@/lib/supabase').supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockState.staff = false;
  mockState.admin = false;
});

it('refuses non-staff', async () => {
  await renderScreen(<AdminHome />);
  expect(await screen.findByText('This area is for Mojere Market staff only.')).toBeTruthy();
  expect(mockRpc).not.toHaveBeenCalledWith('mm_admin_stats');
});

it('shows statistics and all sections to an admin', async () => {
  mockState.staff = true;
  mockState.admin = true;
  await renderScreen(<AdminHome />);
  expect(await screen.findByText('Verified revenue (all time)')).toBeTruthy();
  expect(screen.getByText('₦1,500')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Promotions, plans and payments' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Categories, places and settings' })).toBeTruthy();
});

it('hides admin-only sections from moderators', async () => {
  mockState.staff = true;
  await renderScreen(<AdminHome />);
  expect(await screen.findByRole('button', { name: 'Reports' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Promotions, plans and payments' })).toBeNull();
});

it('requires a reason before removing a listing, then sends the decision to the server', async () => {
  mockState.staff = true;
  mockState.admin = true;
  await renderScreen(<AdminListingsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove listing' }));
  expect(await screen.findByText(/Please write a short reason/)).toBeTruthy();
  expect(mockRpc).not.toHaveBeenCalledWith('mm_admin_moderate_listing', expect.anything());
  await fireEvent.changeText(screen.getByLabelText('Reason (required)'), 'Fake item, reported twice');
  await fireEvent.press(screen.getByRole('button', { name: 'Remove listing' }));
  await waitFor(() =>
    expect(mockRpc).toHaveBeenCalledWith('mm_admin_moderate_listing', {
      p_listing_id: 'l9',
      p_decision: 'remove',
      p_reason: 'Fake item, reported twice',
    }),
  );
});

it('shows the community guidelines, including scam warnings', async () => {
  await renderScreen(<GuidelinesScreen />);
  expect(screen.getByText('Not allowed on Mojere Market')).toBeTruthy();
  expect(screen.getByText(/Never share OTPs/)).toBeTruthy();
});
