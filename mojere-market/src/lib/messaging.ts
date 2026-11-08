import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type ConversationSummary = {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_price_kobo: number | null;
  listing_status: string | null;
  listing_cover_path: string | null;
  i_am_seller: boolean;
  other_id: string;
  other_name: string | null;
  last_body: string | null;
  last_from_me: boolean | null;
  last_message_at: string;
  unread: boolean;
  blocked_by_me: boolean;
};

export type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export const MESSAGE_PAGE = 40;

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

/** The inbox. Refreshes every 30 seconds and when screens ask for it. */
export function useConversations() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['conversations', session?.user.id],
    enabled: !!supabase && !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await client().rpc('mm_my_conversations');
      if (error) throw error;
      return (data ?? []) as ConversationSummary[];
    },
  });
}

export function useUnreadConversations() {
  const c = useConversations();
  return (c.data ?? []).filter((x) => x.unread).length;
}

export async function startConversation(listingId: string) {
  const { data, error } = await client().rpc('mm_start_conversation', { p_listing_id: listingId });
  if (error) throw error;
  return data as string;
}

export async function markConversationRead(id: string) {
  await supabase?.rpc('mm_mark_conversation_read', { p_conversation_id: id });
}

/** Message history, newest first, loaded 40 at a time. */
export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    enabled: !!supabase && !!conversationId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await client()
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: false })
        .range(pageParam * MESSAGE_PAGE, pageParam * MESSAGE_PAGE + MESSAGE_PAGE - 1);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    getNextPageParam: (last, all) => (last.length === MESSAGE_PAGE ? all.length : undefined),
  });
}

/** Add a message to the top of the cached history (if it is not there already). */
function addToCache(qc: ReturnType<typeof useQueryClient>, m: Message) {
  qc.setQueryData<InfiniteData<Message[], number>>(['messages', m.conversation_id], (old) => {
    if (!old) return old;
    if (old.pages.some((p) => p.some((x) => x.id === m.id))) return old;
    const [first = [], ...rest] = old.pages;
    return { ...old, pages: [[m, ...first], ...rest] };
  });
}

/**
 * Live updates: new messages in this chat appear instantly (Supabase
 * Realtime). Only participants receive them, thanks to the security rules.
 */
export function useLiveMessages(conversationId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!supabase || !conversationId) return;
    const db = supabase;
    const channel = db
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          addToCache(qc, payload.new as Message);
          void markConversationRead(conversationId);
          void qc.invalidateQueries({ queryKey: ['conversations'] });
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [conversationId, qc]);
}

export function useSendMessage(conversationId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const text = body.trim();
      if (!text) throw new Error('Type a message first.');
      if (text.length > 2000) throw new Error('Messages can be up to 2,000 characters.');
      const { data, error } = await client()
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: session!.user.id, body: text })
        .select('id, conversation_id, sender_id, body, created_at')
        .single();
      if (error) {
        if (error.message.toLowerCase().includes('row-level security')) {
          throw new Error('You cannot send messages in this conversation.');
        }
        throw error;
      }
      return data as Message;
    },
    onSuccess: (m) => {
      addToCache(qc, m);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export type ConversationDetail = {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
};

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['conversation', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const { data, error } = await client()
        .from('conversations')
        .select('id, listing_id, buyer_id, seller_id')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return (data as ConversationDetail | null) ?? null;
    },
  });
}

/* ---------- Blocking and reporting users ---------- */

export function useBlocks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['blocks', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async () => {
      const { data, error } = await client().from('user_blocks').select('blocked_id');
      if (error) throw error;
      return ((data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
    },
  });
}

export function useBlockUser() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, block }: { userId: string; block: boolean }) => {
      const me = session!.user.id;
      const { error } = block
        ? await client().from('user_blocks').insert({ blocker_id: me, blocked_id: userId })
        : await client().from('user_blocks').delete().eq('blocker_id', me).eq('blocked_id', userId);
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blocks'] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export async function reportUser(userId: string, reason: string, details: string, messageId?: string) {
  const db = client();
  const { data } = await db.auth.getSession();
  const me = data.session?.user.id;
  if (!me) throw new Error('Please log in first.');
  const { error } = await db.from('reports').insert({
    reporter_id: me,
    target_type: messageId ? 'message' : 'user',
    reported_user_id: userId,
    message_id: messageId ?? null,
    reason,
    details: details.trim().slice(0, 1000) || null,
  });
  if (error) throw error;
}
