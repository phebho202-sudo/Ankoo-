import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Condition } from '@/constants/catalog';

import { useAuth } from './auth';
import { supabase } from './supabase';
import { supabaseConfig } from './supabase-config';

export const PAGE_SIZE = 20;

export type ListingSummary = {
  id: string;
  title: string;
  price_kobo: number;
  is_negotiable: boolean;
  condition: Condition;
  status: 'active' | 'reserved' | 'sold';
  published_at: string | null;
  category_slug: string;
  category_name: string;
  lga_name: string;
  town_name: string | null;
  neighbourhood: string | null;
  cover_path: string | null;
  seller_id: string;
  seller_name: string | null;
  is_featured: boolean;
};

export type ListingDetail = {
  id: string;
  title: string;
  description: string;
  condition: Condition;
  price_kobo: number;
  is_negotiable: boolean;
  status: 'draft' | 'active' | 'paused' | 'reserved' | 'sold' | 'removed';
  moderation_status: 'pending' | 'approved' | 'rejected';
  published_at: string | null;
  created_at: string;
  neighbourhood: string | null;
  view_count: number | null;
  category: { slug: string; name: string };
  lga_name: string;
  town_name: string | null;
  images: { path: string; width: number | null; height: number | null }[];
  seller: {
    id: string;
    display_name: string | null;
    avatar_path: string | null;
    member_since: string | null;
    area: string | null;
  };
  is_own: boolean;
  is_favourite: boolean;
};

export type SortOption = 'newest' | 'price_asc' | 'price_desc';

export type ListingFilters = {
  query?: string;
  categorySlug?: string | null;
  lgaId?: string | null;
  minKobo?: number | null;
  maxKobo?: number | null;
  conditions?: Condition[];
  sort?: SortOption;
  featuredOnly?: boolean;
  sellerId?: string | null;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

/** Turn app filters into the database function's parameters. */
export function toSearchParams(f: ListingFilters, page: number, pageSize = PAGE_SIZE) {
  const query = f.query?.trim();
  return {
    p_query: query ? query.slice(0, 100) : null,
    p_category_slug: f.categorySlug ?? null,
    p_lga_id: f.lgaId ?? null,
    p_min_kobo: f.minKobo ?? null,
    p_max_kobo: f.maxKobo ?? null,
    p_conditions: f.conditions && f.conditions.length ? f.conditions : null,
    p_sort: f.sort ?? 'newest',
    p_featured_only: f.featuredOnly ?? false,
    p_seller_id: f.sellerId ?? null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  };
}

export async function searchListings(f: ListingFilters, page = 0, pageSize = PAGE_SIZE) {
  const { data, error } = await requireClient().rpc('mm_search_listings', toSearchParams(f, page, pageSize));
  if (error) throw error;
  return (data ?? []) as ListingSummary[];
}

/** Infinite, paginated results for the Explore screen. */
export function useListingSearch(f: ListingFilters) {
  return useInfiniteQuery({
    queryKey: ['listings', 'search', f],
    enabled: !!supabase,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => searchListings(f, pageParam),
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE ? all.length : undefined),
  });
}

/** A short, single-page list for home-screen sections. */
export function useListingStrip(key: string, f: ListingFilters, size = 10, enabled = true) {
  return useQuery({
    queryKey: ['listings', 'strip', key, f, size],
    enabled: !!supabase && enabled,
    queryFn: () => searchListings(f, 0, size),
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['listing', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('mm_get_listing', { p_listing_id: id });
      if (error) throw error;
      return (data as ListingDetail | null) ?? null;
    },
  });
}

/** Count a product-page view. Failures are ignored: never block the user for this. */
export async function recordListingView(id: string) {
  try {
    await supabase?.rpc('mm_record_listing_view', { p_listing_id: id });
  } catch {
    // ignore
  }
}

/** Public web address of a listing photo. */
export function listingImageUrl(path: string | null | undefined): string | null {
  if (!path || supabaseConfig.status !== 'ready') return null;
  const safe = path.split('/').map(encodeURIComponent).join('/');
  return `${supabaseConfig.url}/storage/v1/object/public/listing-images/${safe}`;
}

export function useToggleFavourite(listingId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (makeFavourite: boolean) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Please log in to save items.');
      const client = requireClient();
      const { error } = makeFavourite
        ? await client.from('favorites').insert({ user_id: userId, listing_id: listingId })
        : await client.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
      if (error && error.code !== '23505') throw error; // 23505 = already saved
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listing', listingId] });
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
    },
  });
}

export const REPORT_REASONS = [
  { value: 'scam', label: 'Looks like a scam' },
  { value: 'prohibited_item', label: 'Prohibited or illegal item' },
  { value: 'fake_or_misleading', label: 'Fake or misleading' },
  { value: 'offensive', label: 'Offensive content' },
  { value: 'spam', label: 'Spam or duplicate' },
  { value: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export async function reportListing(listingId: string, reason: ReportReason, details: string) {
  const client = requireClient();
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Please log in to report a listing.');
  const { error } = await client.from('reports').insert({
    reporter_id: userId,
    target_type: 'listing',
    listing_id: listingId,
    reason,
    details: details.trim().slice(0, 1000) || null,
  });
  if (error) throw error;
}

export type FavouriteEntry = { listing_id: string; created_at: string; listing: ListingSummary | null };

/** The signed-in user's saved items. Hidden or deleted items come back as `listing: null`. */
export function useFavourites() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['favourites', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async () => {
      const { data, error } = await requireClient()
        .from('favorites')
        .select(
          'listing_id, created_at, listing:listings(id, title, price_kobo, is_negotiable, condition, status, published_at, neighbourhood, seller_id, category:categories(slug, name), lga:locations!listings_lga_id_fkey(name), town:locations!listings_town_id_fkey(name), listing_images(storage_path, position))',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      type Row = {
        listing_id: string;
        created_at: string;
        listing:
          | (Omit<ListingSummary, 'category_slug' | 'category_name' | 'lga_name' | 'town_name' | 'cover_path' | 'seller_name' | 'is_featured'> & {
              category: { slug: string; name: string } | null;
              lga: { name: string } | null;
              town: { name: string } | null;
              listing_images: { storage_path: string; position: number }[];
            })
          | null;
      };
      return ((data ?? []) as unknown as Row[]).map((r): FavouriteEntry => {
        const l = r.listing;
        if (!l) return { listing_id: r.listing_id, created_at: r.created_at, listing: null };
        const cover = [...l.listing_images].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null;
        return {
          listing_id: r.listing_id,
          created_at: r.created_at,
          listing: {
            id: l.id,
            title: l.title,
            price_kobo: l.price_kobo,
            is_negotiable: l.is_negotiable,
            condition: l.condition,
            status: l.status,
            published_at: l.published_at,
            category_slug: l.category?.slug ?? '',
            category_name: l.category?.name ?? '',
            lga_name: l.lga?.name ?? '',
            town_name: l.town?.name ?? null,
            neighbourhood: l.neighbourhood,
            cover_path: cover,
            seller_id: l.seller_id,
            seller_name: null,
            is_featured: false,
          },
        };
      });
    },
  });
}

export async function removeFavourite(listingId: string) {
  const db = requireClient();
  const { data } = await db.auth.getSession();
  const me = data.session?.user.id;
  if (!me) return;
  const { error } = await db.from('favorites').delete().eq('user_id', me).eq('listing_id', listingId);
  if (error) throw error;
}
