// Shared helpers for sending Expo push notifications (Mojere Market).
// Plain TypeScript, tested in the app's automated tests.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

export type PushMessage = {
  to: string;
  title: string;
  body?: string;
  data: Record<string, unknown>;
  sound: 'default';
  channelId: 'default';
};

/** Database Webhook payloads look like { type: 'INSERT', table: 'notifications', record: {...} }. */
export function parseNotificationInsert(payload: unknown): NotificationRow | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { type?: unknown; table?: unknown; record?: Record<string, unknown> };
  if (p.type !== 'INSERT' || p.table !== 'notifications' || !p.record) return null;
  const r = p.record;
  if (typeof r.id !== 'string' || typeof r.user_id !== 'string' || typeof r.title !== 'string') return null;
  return {
    id: r.id,
    user_id: r.user_id,
    type: typeof r.type === 'string' ? r.type : 'account',
    title: r.title,
    body: typeof r.body === 'string' ? r.body : null,
    data: r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : null,
  };
}

/** One message per device. Message text is shortened so previews stay tidy. */
export function buildPushMessages(n: NotificationRow, tokens: string[]): PushMessage[] {
  const valid = tokens.filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t));
  return valid.map((to) => ({
    to,
    title: n.title.slice(0, 100),
    ...(n.body ? { body: n.body.slice(0, 180) } : {}),
    data: { ...(n.data ?? {}), notification_id: n.id, type: n.type },
    sound: 'default',
    channelId: 'default',
  }));
}

/** Tokens Expo says are no longer valid (app uninstalled), so they can be removed. */
export function deadTokens(messages: PushMessage[], tickets: unknown): string[] {
  if (!Array.isArray(tickets)) return [];
  return tickets.flatMap((t, i) => {
    const ticket = t as { status?: string; details?: { error?: string } };
    return ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i]!.to] : [];
  });
}
