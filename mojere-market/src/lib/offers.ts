import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired';

export type Offer = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  made_by: 'buyer' | 'seller';
  parent_offer_id: string | null;
  amount_kobo: number;
  message: string | null;
  status: OfferStatus;
  expires_at: string;
  created_at: string;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'Waiting for a reply',
  accepted: 'Accepted',
  rejected: 'Declined',
  countered: 'Countered',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

/** Turn database messages into plain, helpful ones. */
export function friendlyOfferError(e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : '';
  return m || 'That did not work. Please try again.';
}

/** All offers between one buyer and the seller of one listing, newest first. */
export function useOffers(listingId: string | null | undefined, buyerId: string | undefined) {
  return useQuery({
    queryKey: ['offers', listingId, buyerId],
    enabled: !!supabase && !!listingId && !!buyerId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await client()
        .from('offers')
        .select('*')
        .eq('listing_id', listingId!)
        .eq('buyer_id', buyerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });
}

/** Has the signed-in user already reviewed this sale? */
export function useMyReview(offerId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-review', offerId],
    enabled: !!supabase && !!offerId && !!session,
    queryFn: async () => {
      const { data, error } = await client()
        .from('reviews')
        .select('id, rating')
        .eq('offer_id', offerId!)
        .eq('reviewer_id', session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; rating: number } | null;
    },
  });
}

function useOfferMutation<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['offers', 'my-review', 'listing', 'listings', 'my-listings', 'conversations', 'notifications']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useMakeOffer() {
  return useOfferMutation(async (v: { listingId: string; amountKobo: number; message: string }) => {
    const { error } = await client().rpc('mm_make_offer', {
      p_listing_id: v.listingId,
      p_amount_kobo: v.amountKobo,
      p_message: v.message.trim() || null,
    });
    if (error) throw error;
  });
}

export function useRespondToOffer() {
  return useOfferMutation(
    async (v: { offerId: string; action: 'accept' | 'reject' | 'counter' | 'withdraw'; counterKobo?: number }) => {
      const { error } = await client().rpc('mm_respond_to_offer', {
        p_offer_id: v.offerId,
        p_action: v.action,
        p_counter_kobo: v.counterKobo ?? null,
      });
      if (error) throw error;
    },
  );
}

export function useConfirmHandover() {
  return useOfferMutation(async (offerId: string) => {
    const { error } = await client().rpc('mm_confirm_handover', { p_offer_id: offerId });
    if (error) throw error;
  });
}

export function useSubmitReview() {
  return useOfferMutation(async (v: { offerId: string; rating: number; comment: string }) => {
    const { error } = await client().rpc('mm_submit_review', {
      p_offer_id: v.offerId,
      p_rating: v.rating,
      p_comment: v.comment.trim() || null,
    });
    if (error) throw error;
  });
}

export type RatingSummary = { average: number | null; count: number };

export function useRatingSummary(userId: string | undefined) {
  return useQuery({
    queryKey: ['ratings', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data, error } = await client()
        .from('reviews')
        .select('rating, comment, created_at')
        .eq('reviewee_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as { rating: number; comment: string | null; created_at: string }[];
      const average = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
      return { average, count: rows.length, recent: rows.slice(0, 5) };
    },
  });
}
