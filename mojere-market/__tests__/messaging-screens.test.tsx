import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import MessagesScreen from '@/app/(tabs)/messages';
import ChatScreen from '@/app/chat/[id]';
import ListingScreen from '@/app/listing/[id]';

import { mockRouter, setMockParams } from '../testing/expo-router-mock';
import { renderScreen } from '../testing/render';

jest.mock('expo-router', () => ({
  ...require('../testing/expo-router-mock').expoRouterMock,
  Stack: { Screen: () => null },
}));

const ME = 'u-buyer';
const SELLER = 'u-seller';
const mockDb: { signedIn: boolean; tables: Record<string, unknown>; rpc: Record<string, unknown>; inserts: unknown[] } = {
  signedIn: true,
  tables: {},
  rpc: {},
  inserts: [],
};

jest.mock('@/lib/supabase', () => {
  const from = (name: string) => {
    const q: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'order', 'range', 'update', 'delete', 'in', 'is', 'limit']) q[op] = () => q;
    q.insert = (row: unknown) => {
      mockDb.inserts.push({ table: name, row });
      return q;
    };
    q.single = async () => ({
      data: { id: 'm-new', conversation_id: 'c1', sender_id: 'u-buyer', body: 'Is it available?', created_at: new Date().toISOString() },
      error: null,
    });
    q.maybeSingle = async () => ({ data: mockDb.tables[`${name}:one`] ?? null, error: null });
    q.then = (resolve: (v: unknown) => void) => resolve({ data: mockDb.tables[name] ?? [], error: null });
    return q;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from,
      rpc: jest.fn(async (fn: string) => ({ data: mockDb.rpc[fn] ?? null, error: null })),
      channel: () => channel,
      removeChannel: jest.fn(),
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: mockDb.signedIn ? { user: { id: 'u-buyer', email_confirmed_at: 'x' } } : null },
        })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      },
    },
    checkSupabaseConnection: jest.fn(),
  };
});
const mockRpc = require('@/lib/supabase').supabase.rpc as jest.Mock;

const summary = {
  id: 'c1',
  listing_id: 'l1',
  listing_title: 'Standing fan',
  listing_price_kobo: 2500000,
  listing_status: 'active',
  listing_cover_path: null,
  i_am_seller: false,
  other_id: SELLER,
  other_name: 'Gbenga',
  last_body: 'Yes it is.',
  last_from_me: false,
  last_message_at: new Date().toISOString(),
  unread: true,
  blocked_by_me: false,
};

function offer(over: Record<string, unknown>) {
  return {
    id: 'o1', listing_id: 'l1', buyer_id: ME, seller_id: SELLER, made_by: 'buyer', parent_offer_id: null,
    amount_kobo: 2000000, message: null, status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(), buyer_confirmed_at: null, seller_confirmed_at: null, ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.signedIn = true;
  mockDb.inserts = [];
  mockDb.rpc = { mm_my_conversations: [summary] };
  mockDb.tables = {
    'conversations:one': { id: 'c1', listing_id: 'l1', buyer_id: ME, seller_id: SELLER },
    messages: [{ id: 'm1', conversation_id: 'c1', sender_id: SELLER, body: 'Yes it is.', created_at: new Date().toISOString() }],
    offers: [],
  };
  setMockParams({ id: 'c1' });
});

describe('Inbox', () => {
  it('lists conversations with the item and an unread marker', async () => {
    await renderScreen(<MessagesScreen />);
    expect(await screen.findByText('Standing fan')).toBeTruthy();
    expect(screen.getByLabelText(/Gbenga, about Standing fan, unread/)).toBeTruthy();
  });

  it('opens a conversation', async () => {
    await renderScreen(<MessagesScreen />);
    await fireEvent.press(await screen.findByLabelText(/Gbenga, about Standing fan/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'c1' } });
  });

  it('shows a helpful empty state', async () => {
    mockDb.rpc = { mm_my_conversations: [] };
    await renderScreen(<MessagesScreen />);
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
  });
});

describe('Chat', () => {
  it('shows messages and sends a new one', async () => {
    await renderScreen(<ChatScreen />);
    expect(await screen.findByText('Yes it is.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Is it available?');
    await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(mockDb.inserts).toContainEqual({ table: 'messages', row: { conversation_id: 'c1', sender_id: ME, body: 'Is it available?' } }),
    );
  });

  it('lets the buyer make an offer when none is open', async () => {
    await renderScreen(<ChatScreen />);
    expect(await screen.findByRole('button', { name: 'Make offer' })).toBeTruthy();
  });

  it('lets the buyer answer a seller counteroffer', async () => {
    mockDb.tables.offers = [offer({ id: 'o2', made_by: 'seller', amount_kobo: 2200000 })];
    await renderScreen(<ChatScreen />);
    expect(await screen.findByText(/Seller’s counteroffer: ₦22,000/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Counter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make offer' })).toBeNull();
  });

  it('lets the buyer withdraw their own offer', async () => {
    mockDb.tables.offers = [offer({})];
    await renderScreen(<ChatScreen />);
    expect(await screen.findByRole('button', { name: 'Withdraw offer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('asks both sides to confirm the handover after acceptance', async () => {
    mockDb.tables.offers = [offer({ status: 'accepted', seller_confirmed_at: new Date().toISOString() })];
    await renderScreen(<ChatScreen />);
    expect(await screen.findByRole('button', { name: 'I received the item' })).toBeTruthy();
    expect(screen.getByText('The seller has already confirmed.')).toBeTruthy();
  });

  it('offers a review only after both sides confirmed', async () => {
    const now = new Date().toISOString();
    mockDb.tables.offers = [offer({ status: 'accepted', seller_confirmed_at: now, buyer_confirmed_at: now })];
    await renderScreen(<ChatScreen />);
    expect(await screen.findByText(/Sale confirmed by both of you/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Review the seller' })).toBeTruthy();
  });

  it('hides the message box after blocking', async () => {
    mockDb.rpc = { mm_my_conversations: [{ ...summary, blocked_by_me: true }] };
    await renderScreen(<ChatScreen />);
    expect(await screen.findByText(/You blocked this person/)).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
  });
});

describe('Product page buttons', () => {
  const detail = {
    id: 'l1', title: 'Standing fan', description: '', condition: 'good', price_kobo: 2500000, is_negotiable: true,
    status: 'active', moderation_status: 'approved', published_at: new Date().toISOString(), created_at: new Date().toISOString(),
    neighbourhood: null, view_count: null, category: { slug: 'home-appliances', name: 'Home appliances' },
    lga_name: 'Akure South', town_name: null, images: [],
    seller: { id: SELLER, display_name: 'Gbenga', avatar_path: null, member_since: null, area: null },
    is_own: false, is_favourite: false,
  };

  beforeEach(() => {
    setMockParams({ id: 'l1' });
    mockDb.rpc = { mm_get_listing: detail, mm_verification_status: [], mm_start_conversation: 'c1' };
  });

  it('Message seller opens the chat', async () => {
    await renderScreen(<ListingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Message seller' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'c1' } }));
    expect(mockRpc).toHaveBeenCalledWith('mm_start_conversation', { p_listing_id: 'l1' });
  });

  it('Make an offer opens the chat with the offer form', async () => {
    await renderScreen(<ListingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Make an offer' }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'c1', offer: '1' } }),
    );
  });

  it('visitors are asked to log in first', async () => {
    mockDb.signedIn = false;
    await renderScreen(<ListingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Message seller' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-in');
    expect(mockRpc).not.toHaveBeenCalledWith('mm_start_conversation', expect.anything());
  });
});
