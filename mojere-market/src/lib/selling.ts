import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { INITIAL_CATEGORIES, type Condition } from '@/constants/catalog';

import { useAuth } from './auth';
import { removeListingPhotos, uploadListingPhoto, type PhotoItem } from './photos';
import { supabase } from './supabase';

export type ListingStatus = 'draft' | 'active' | 'paused' | 'reserved' | 'sold' | 'removed';

export type ListingInput = {
  title: string;
  description: string;
  categoryId: string;
  condition: Condition;
  priceKobo: number;
  isNegotiable: boolean;
  lgaId: string;
  townId: string | null;
  neighbourhood: string;
  businessId?: string | null;
};

export type MyListing = {
  id: string;
  business_id: string | null;
  title: string;
  description: string;
  category_id: string;
  condition: Condition;
  price_kobo: number;
  is_negotiable: boolean;
  lga_id: string;
  town_id: string | null;
  neighbourhood: string | null;
  status: ListingStatus;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_note: string | null;
  view_count: number;
  created_at: string;
  published_at: string | null;
  listing_images: { storage_path: string; position: number }[];
};

const MY_LISTING_COLUMNS =
  'id, title, description, category_id, business_id, condition, price_kobo, is_negotiable, lga_id, town_id, neighbourhood, status, moderation_status, moderation_note, view_count, created_at, published_at, listing_images(storage_path, position)';

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

function toRow(v: ListingInput) {
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    category_id: v.categoryId,
    condition: v.condition,
    price_kobo: v.priceKobo,
    is_negotiable: v.isNegotiable,
    lga_id: v.lgaId,
    town_id: v.townId,
    neighbourhood: v.neighbourhood.trim() || null,
    business_id: v.businessId ?? null,
  };
}

/** What a listing still needs before it can be published. Empty = ready. */
export function missingForPublish(v: { title?: string; categoryId?: string | null; lgaId?: string | null; photoCount: number }) {
  const missing: string[] = [];
  if (!v.title || v.title.trim().length < 3) missing.push('a title');
  if (!v.categoryId) missing.push('a category');
  if (!v.lgaId) missing.push('a location');
  if (v.photoCount < 1) missing.push('at least one photo');
  return missing;
}

/**
 * Save a listing with its photos.
 *
 * Order matters for safety on bad connections: the listing is saved as a
 * DRAFT first, photos are uploaded, and only then is it published. If
 * anything fails half-way, nothing half-finished is ever shown publicly.
 */
export async function saveListing(opts: {
  userId: string;
  listingId?: string;
  values: ListingInput;
  photos: PhotoItem[];
  publish: boolean;
  onProgress?: (message: string) => void;
}) {
  const db = client();
  const { userId, values, photos, publish, onProgress } = opts;
  let listingId = opts.listingId;

  onProgress?.('Saving details…');
  if (!listingId) {
    const { data, error } = await db
      .from('listings')
      .insert({ ...toRow(values), seller_id: userId, status: 'draft' })
      .select('id')
      .single();
    if (error) throw error;
    listingId = (data as { id: string }).id;
  } else {
    const { error } = await db.from('listings').update(toRow(values)).eq('id', listingId);
    if (error) throw error;
  }

  // Upload new photos, keep existing ones, in the order shown on screen.
  const finalPhotos: { path: string; width: number | null; height: number | null }[] = [];
  let done = 0;
  for (const p of photos) {
    if (p.path) {
      finalPhotos.push({ path: p.path, width: null, height: null });
    } else if (p.uri) {
      onProgress?.(`Uploading photo ${++done} of ${photos.filter((x) => x.uri).length}…`);
      finalPhotos.push(await uploadListingPhoto(userId, p.uri));
    }
  }

  // Replace the photo list in one go so positions stay tidy.
  const { data: oldRows } = await db.from('listing_images').select('storage_path').eq('listing_id', listingId);
  const { error: delError } = await db.from('listing_images').delete().eq('listing_id', listingId);
  if (delError) throw delError;
  if (finalPhotos.length) {
    const { error } = await db.from('listing_images').insert(
      finalPhotos.map((p, i) => ({
        listing_id: listingId,
        storage_path: p.path,
        position: i,
        width: p.width,
        height: p.height,
      })),
    );
    if (error) throw error;
  }
  const kept = new Set(finalPhotos.map((p) => p.path));
  const dropped = ((oldRows ?? []) as { storage_path: string }[])
    .map((r) => r.storage_path)
    .filter((path) => !kept.has(path));
  await removeListingPhotos(dropped);

  if (publish) {
    onProgress?.('Publishing…');
    const { error } = await db.from('listings').update({ status: 'active' }).eq('id', listingId);
    if (error) throw error;
  }
  return listingId;
}

export async function setListingStatus(id: string, status: Exclude<ListingStatus, 'removed'>) {
  const { error } = await client().from('listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(id: string) {
  const db = client();
  const { data } = await db.from('listing_images').select('storage_path').eq('listing_id', id);
  const { error } = await db.from('listings').delete().eq('id', id);
  if (error) throw error;
  await removeListingPhotos(((data ?? []) as { storage_path: string }[]).map((r) => r.storage_path));
}

export function useMyListings() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-listings', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data, error } = await client()
        .from('listings')
        .select(MY_LISTING_COLUMNS)
        .eq('seller_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as MyListing[]).map((l) => ({
        ...l,
        listing_images: [...l.listing_images].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

export function useMyListing(id: string | undefined) {
  return useQuery({
    queryKey: ['my-listing', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const { data, error } = await client().from('listings').select(MY_LISTING_COLUMNS).eq('id', id!).maybeSingle();
      if (error) throw error;
      const l = data as MyListing | null;
      return l ? { ...l, listing_images: [...l.listing_images].sort((a, b) => a.position - b.position) } : null;
    },
  });
}

export type Category = { id: string; slug: string; name: string; icon: string | null; is_active: boolean };

export function useCategories() {
  return useQuery({
    queryKey: ['categories', 'active'],
    enabled: !!supabase,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await client().from('categories').select('id, slug, name, icon, is_active').order('sort_order');
      if (error) throw error;
      // Admins can see hidden categories; nobody should be offered them.
      return ((data ?? []) as Category[]).filter((c) => c.is_active);
    },
  });
}

/** Refresh every list that may show a changed listing. */
export function useInvalidateListings() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['my-listings'] }),
      qc.invalidateQueries({ queryKey: ['my-listing'] }),
      qc.invalidateQueries({ queryKey: ['listings'] }),
      qc.invalidateQueries({ queryKey: ['listing'] }),
      qc.invalidateQueries({ queryKey: ['declutter'] }),
    ]);
}

export function useListingAction() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: async (a: { id: string; action: 'pause' | 'resume' | 'sold' | 'delete' }) => {
      if (a.action === 'delete') return deleteListing(a.id);
      return setListingStatus(a.id, a.action === 'pause' ? 'paused' : a.action === 'sold' ? 'sold' : 'active');
    },
    onSuccess: () => invalidate(),
  });
}

/** Categories for browsing: the live list from the database, or the built-in list until it loads. */
export function useBrowseCategories() {
  const live = useCategories();
  if (live.data && live.data.length) {
    return live.data.map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: (c.icon ?? 'pricetag-outline') as (typeof INITIAL_CATEGORIES)[number]['icon'],
    }));
  }
  return INITIAL_CATEGORIES;
}
