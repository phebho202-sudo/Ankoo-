import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { conversation_id?: string; listing_id?: string; offer_id?: string };
  read_at: string | null;
  created_at: string;
};

export type NotificationPrefs = {
  messages: boolean;
  offers: boolean;
  listing_updates: boolean;
  account: boolean;
  promotions: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  messages: true,
  offers: true,
  listing_updates: true,
  account: true,
  promotions: true,
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

export function useNotifications() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['notifications', session?.user.id],
    enabled: !!supabase && !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await client()
        .from('notifications')
        .select('id, type, title, body, data, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useUnreadNotifications() {
  const n = useNotifications();
  return (n.data ?? []).filter((x) => !x.read_at).length;
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      let q = client().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (ids !== 'all') q = q.in('id', ids);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/**
 * Find the chat a notification belongs to. Offer notifications carry the
 * offer; the chat is the one between that buyer and seller for the item.
 */
export async function conversationForNotification(n: AppNotification): Promise<string | null> {
  if (n.data.conversation_id) return n.data.conversation_id;
  if (!n.data.offer_id) return null;
  const db = client();
  const { data: offer } = await db.from('offers').select('listing_id, buyer_id').eq('id', n.data.offer_id).maybeSingle();
  if (!offer) return null;
  const o = offer as { listing_id: string; buyer_id: string };
  const { data: conv } = await db
    .from('conversations')
    .select('id')
    .eq('listing_id', o.listing_id)
    .eq('buyer_id', o.buyer_id)
    .maybeSingle();
  return (conv as { id: string } | null)?.id ?? null;
}

export function useNotificationPrefs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['notification-prefs', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async () => {
      const { data, error } = await client()
        .from('notification_preferences')
        .select('messages, offers, listing_updates, account, promotions')
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationPrefs | null) ?? DEFAULT_PREFS;
    },
  });
}

export function useSaveNotificationPrefs() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      const { error } = await client()
        .from('notification_preferences')
        .upsert({ user_id: session!.user.id, ...prefs }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });
}
