import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from './auth';
import { missingForPublish, useInvalidateListings, type ListingStatus } from './selling';
import { supabase } from './supabase';

export type DeclutterSession = {
  id: string;
  title: string;
  status: 'in_progress' | 'completed';
  created_at: string;
  declutter_session_items: { listing: { status: ListingStatus } | null }[];
};

export type DeclutterItem = {
  id: string;
  title: string;
  price_kobo: number;
  status: ListingStatus;
  moderation_status: 'pending' | 'approved' | 'rejected';
  category_id: string | null;
  lga_id: string | null;
  listing_images: { storage_path: string; position: number }[];
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

export function useDeclutterSessions() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['declutter', 'sessions', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data, error } = await client()
        .from('declutter_sessions')
        .select('id, title, status, created_at, declutter_session_items(listing:listings(status))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeclutterSession[];
    },
  });
}

export function useDeclutterSession(id: string | undefined) {
  return useQuery({
    queryKey: ['declutter', 'session', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const db = client();
      const { data: s, error } = await db
        .from('declutter_sessions')
        .select('id, title, status, created_at')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!s) return null;
      const { data: rows, error: itemsError } = await db
        .from('declutter_session_items')
        .select(
          'created_at, listing:listings(id, title, price_kobo, status, moderation_status, category_id, lga_id, listing_images(storage_path, position))',
        )
        .eq('session_id', id!)
        .order('created_at', { ascending: true });
      if (itemsError) throw itemsError;
      const items = ((rows ?? []) as unknown as { listing: DeclutterItem | null }[])
        .map((r) => r.listing)
        .filter((l): l is DeclutterItem => !!l)
        .map((l) => ({ ...l, listing_images: [...l.listing_images].sort((a, b) => a.position - b.position) }));
      return { session: s as Omit<DeclutterSession, 'declutter_session_items'>, items };
    },
  });
}

export async function createDeclutterSession(userId: string, title: string) {
  const { data, error } = await client()
    .from('declutter_sessions')
    .insert({ user_id: userId, title: title.trim() || 'My declutter session' })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function addToDeclutterSession(sessionId: string, listingId: string) {
  const { error } = await client().from('declutter_session_items').insert({ session_id: sessionId, listing_id: listingId });
  if (error && error.code !== '23505') throw error; // already linked
}

/** Which drafts are complete enough to publish, and which still need work. */
export function splitPublishable(items: DeclutterItem[]) {
  const drafts = items.filter((i) => i.status === 'draft');
  const ready = drafts.filter(
    (i) => missingForPublish({ title: i.title, categoryId: i.category_id, lgaId: i.lga_id, photoCount: i.listing_images.length }).length === 0,
  );
  const incomplete = drafts.filter((i) => !ready.includes(i));
  return { ready, incomplete };
}

export function usePublishDrafts() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await client().from('listings').update({ status: 'active' }).in('id', ids).eq('status', 'draft');
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useCompleteSession() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client().from('declutter_sessions').update({ status: 'completed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Draft',
  active: 'Available',
  paused: 'Paused',
  reserved: 'Reserved',
  sold: 'Sold',
  removed: 'Removed',
};
