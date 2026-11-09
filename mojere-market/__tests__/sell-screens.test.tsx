import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import SellScreen from '@/app/(tabs)/sell';
import ListingEditorScreen from '@/app/listing-editor';

import { setMockParams } from '../testing/expo-router-mock';
import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => ({
  ...require('../testing/expo-router-mock').expoRouterMock,
  Stack: { Screen: () => null },
}));

const mockSession = { user: { id: 'u1', email_confirmed_at: '2026-11-08' } };
const mockState = { signedIn: false };

jest.mock('@/lib/supabase', () => {
  const rows: Record<string, unknown> = {
    user_profiles: { id: 'u1', display_name: 'Demola', lga_id: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a11', town_id: null, neighbourhood: null, account_status: 'active', created_at: '2026-11-08' },
    categories: [{ id: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a10', slug: 'furniture', name: 'Furniture', icon: 'bed-outline', is_active: true }],
    locations: [{ id: '6f1c1f0e-3b7a-4c1e-9d55-2f6f0b6c9a11', slug: 'akure-south', name: 'Akure South', kind: 'lga', parent_id: null }],
  };
  const from = jest.fn((name: string) => {
    const q: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'in']) q[op] = () => q;
    q.maybeSingle = async () => ({ data: rows[name] ?? null, error: null });
    q.single = async () => ({ data: { id: 'new' }, error: null });
    q.then = (resolve: (v: unknown) => void) => resolve({ data: rows[name] ?? [], error: null });
    return q;
  });
  return {
    supabase: {
      from,
      rpc: jest.fn(async () => ({ data: [], error: null })),
      auth: {
        getSession: jest.fn(async () => ({ data: { session: mockState.signedIn ? mockSession : null } })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    },
    checkSupabaseConnection: jest.fn(),
  };
});
const mockFrom = require('@/lib/supabase').supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  setMockParams({});
  mockState.signedIn = false;
});

describe('Sell tab', () => {
  it('asks visitors to log in before selling', async () => {
    await renderScreen(<SellScreen />);
    expect(await screen.findByText('Log in to start selling')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sell an item' })).toBeNull();
  });

  it('shows selling, decluttering and my listings when logged in', async () => {
    mockState.signedIn = true;
    await renderScreen(<SellScreen />);
    expect(await screen.findByRole('button', { name: 'Sell an item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Declutter My Home' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'My listings' })).toBeTruthy();
  });
});

describe('Sell an item form', () => {
  beforeEach(() => {
    mockState.signedIn = true;
  });

  async function fillForm() {
    await fireEvent.changeText(await screen.findByLabelText('Title'), 'Wooden study table');
    await fireEvent.press(screen.getByRole('button', { name: /Category/ }));
    await fireEvent.press(await screen.findByText('Furniture'));
    await fireEvent.press(screen.getByRole('button', { name: 'Good' }));
    await fireEvent.changeText(screen.getByLabelText('Price (₦)'), '15000');
  }

  it('fills the location from the seller profile', async () => {
    await renderScreen(<ListingEditorScreen />);
    expect(await screen.findByText('Akure South')).toBeTruthy();
  });

  it('refuses to publish without a photo, and nothing is saved', async () => {
    await renderScreen(<ListingEditorScreen />);
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Preview and publish' }));
    expect(await screen.findByText(/Before publishing, add at least one photo/)).toBeTruthy();
    expect(mockFrom.mock.calls.some(([t]) => t === 'listings')).toBe(false);
  });

  it('can save a draft without photos', async () => {
    await renderScreen(<ListingEditorScreen />);
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(mockFrom.mock.calls.some(([t]) => t === 'listings')).toBe(true));
  });

  it('shows clear messages for missing details', async () => {
    await renderScreen(<ListingEditorScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByText(/short title/)).toBeTruthy();
    expect(screen.getByText('Choose a category.')).toBeTruthy();
    expect(screen.getByText(/Enter a price in Naira/)).toBeTruthy();
  });
});
