import { buildPushMessages, deadTokens, parseNotificationInsert } from '../supabase/functions/_shared/push';
import { routeForNotificationData } from '@/lib/push';

const row = {
  id: 'n1',
  user_id: 'u1',
  type: 'message',
  title: 'New message from Funmi',
  body: 'Is the fan still available? '.repeat(10),
  data: { conversation_id: 'c1' },
};

describe('push notifications (server helpers)', () => {
  it('reads Supabase webhook inserts and ignores anything else', () => {
    expect(parseNotificationInsert({ type: 'INSERT', table: 'notifications', record: row })).toMatchObject({ id: 'n1', user_id: 'u1' });
    expect(parseNotificationInsert({ type: 'UPDATE', table: 'notifications', record: row })).toBeNull();
    expect(parseNotificationInsert({ type: 'INSERT', table: 'messages', record: row })).toBeNull();
    expect(parseNotificationInsert('nonsense')).toBeNull();
  });

  it('builds one tidy message per real device token', () => {
    const msgs = buildPushMessages(row, ['ExponentPushToken[abc]', 'not-a-token', 'ExpoPushToken[def]']);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.body!.length).toBeLessThanOrEqual(180);
    expect(msgs[0]!.data).toMatchObject({ conversation_id: 'c1', notification_id: 'n1', type: 'message' });
  });

  it('finds tokens for phones that uninstalled the app', () => {
    const msgs = buildPushMessages(row, ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    const tickets = [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }];
    expect(deadTokens(msgs, tickets)).toEqual(['ExponentPushToken[b]']);
    expect(deadTokens(msgs, null)).toEqual([]);
  });
});

describe('tapping an alert', () => {
  it('opens the chat or the item', () => {
    expect(routeForNotificationData({ conversation_id: 'c1' })).toEqual({ pathname: '/chat/[id]', params: { id: 'c1' } });
    expect(routeForNotificationData({ listing_id: 'l1' })).toEqual({ pathname: '/listing/[id]', params: { id: 'l1' } });
    expect(routeForNotificationData({})).toBeNull();
  });
});
