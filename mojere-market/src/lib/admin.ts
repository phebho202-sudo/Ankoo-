import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { supabase } from './supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

/** Role checks run on the server; the app only uses them to show or hide screens. */
export function useStaffRole() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['staff-role', session?.user.id],
    enabled: !!supabase && !!session,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const db = client();
      const [staff, admin] = await Promise.all([db.rpc('mm_is_staff'), db.rpc('mm_is_admin')]);
      return { isStaff: staff.data === true, isAdmin: admin.data === true };
    },
  });
}

export type AdminStats = Record<
  | 'users' | 'new_users_7d' | 'suspended_users' | 'active_listings' | 'new_listings_7d' | 'pending_review'
  | 'sold_listings' | 'confirmed_sales' | 'open_reports' | 'conversations' | 'businesses' | 'active_promotions'
  | 'pending_promotions' | 'revenue_kobo' | 'revenue_30d_kobo',
  number
>;

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client().rpc('mm_admin_stats');
      if (error) throw error;
      return data as AdminStats;
    },
  });
}

export type AdminUser = {
  id: string;
  display_name: string;
  email: string | null;
  account_status: 'active' | 'suspended';
  created_at: string;
  email_verified: boolean;
  active_listings: number;
  open_reports: number;
  role: 'admin' | 'moderator' | null;
};

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin', 'users', search],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client().rpc('mm_admin_list_users', { p_search: search || null, p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export type AdminListing = {
  id: string;
  title: string;
  price_kobo: number;
  status: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_note: string | null;
  created_at: string;
  seller_id: string;
  seller: { display_name: string } | null;
  listing_images: { storage_path: string; position: number }[];
};

export type ListingQueue = 'pending' | 'rejected' | 'removed' | 'live';

export function useAdminListings(queue: ListingQueue) {
  return useQuery({
    queryKey: ['admin', 'listings', queue],
    enabled: !!supabase,
    queryFn: async () => {
      let q = client()
        .from('listings')
        .select(
          'id, title, price_kobo, status, moderation_status, moderation_note, created_at, seller_id, seller:user_profiles!listings_seller_id_fkey(display_name), listing_images(storage_path, position)',
        )
        .order('created_at', { ascending: false })
        .limit(100);
      if (queue === 'pending') q = q.eq('moderation_status', 'pending').neq('status', 'draft');
      if (queue === 'rejected') q = q.eq('moderation_status', 'rejected');
      if (queue === 'removed') q = q.eq('status', 'removed');
      if (queue === 'live') q = q.in('status', ['active', 'reserved']).eq('moderation_status', 'approved');
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminListing[];
    },
  });
}

export type AdminReport = {
  id: string;
  target_type: 'listing' | 'user' | 'message';
  listing_id: string | null;
  reported_user_id: string | null;
  message_id: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  created_at: string;
};

export function useAdminReports(open: boolean) {
  return useQuery({
    queryKey: ['admin', 'reports', open],
    enabled: !!supabase,
    queryFn: async () => {
      let q = client().from('reports').select('*').order('created_at', { ascending: !open }).limit(100);
      q = open ? q.in('status', ['open', 'reviewing']) : q.in('status', ['resolved', 'dismissed']);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminReport[];
    },
  });
}

export type ReportContext = {
  reporter: string | null;
  reported_user: { id: string; name: string; status: string } | null;
  listing: { id: string; title: string; status: string; moderation_status: string; seller_id: string } | null;
  message: { body: string; created_at: string; sender_id: string; sender_name: string | null } | null;
  other_reports_on_target: number;
};

export function useReportContext(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'report-context', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const { data, error } = await client().rpc('mm_admin_report_context', { p_report_id: id });
      if (error) throw error;
      return data as ReportContext;
    },
  });
}

export type AuditEntry = {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
};

export function useAuditLog() {
  return useQuery({
    queryKey: ['admin', 'audit'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client()
        .from('admin_actions')
        .select('id, admin_id, action, target_type, target_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });
}

export type AdminPromotion = {
  id: string;
  status: string;
  price_kobo: number;
  created_at: string;
  ends_at: string | null;
  listing: { id: string; title: string } | null;
  package: { name: string } | null;
  purchaser: { display_name: string } | null;
};

export function useAdminPromotions() {
  return useQuery({
    queryKey: ['admin', 'promotions'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client()
        .from('promotions')
        .select(
          'id, status, price_kobo, created_at, ends_at, listing:listings(id, title), package:promotion_packages(name), purchaser:user_profiles!promotions_purchaser_id_fkey(display_name)',
        )
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AdminPromotion[];
    },
  });
}

export type PaymentRow = {
  id: string;
  reference: string;
  purpose: string;
  amount_kobo: number;
  status: string;
  created_at: string;
  verified_at: string | null;
};

export function useAdminPayments() {
  return useQuery({
    queryKey: ['admin', 'payments'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client()
        .from('payment_records')
        .select('id, reference, purpose, amount_kobo, status, created_at, verified_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });
}

/** Run an admin server function, then refresh every admin list. */
export function useAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      const { error } = await client().rpc(fn, args);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ['admin', 'listings', 'listing', 'my-listings', 'my-promotions']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/** Direct edits to admin-managed tables (protected by admin-only security rules). */
export function useAdminTableEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { table: string; id?: string; idColumn?: string; values: Record<string, unknown> }) => {
      const db = client().from(v.table);
      const { error } = v.id ? await db.update(v.values).eq(v.idColumn ?? 'id', v.id) : await db.insert(v.values);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ['admin', 'categories', 'locations', 'business-plans', 'promotion-packages', 'app-settings', 'meetup']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client().from('app_settings').select('key, value');
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
    },
  });
}

export type ReferenceRow = { id: string; slug: string; name: string; is_active: boolean; sort_order: number };

export function useAllCategories() {
  return useQuery({
    queryKey: ['categories', 'all'],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await client().from('categories').select('id, slug, name, is_active, sort_order, icon').order('sort_order');
      if (error) throw error;
      return (data ?? []) as (ReferenceRow & { icon: string | null })[];
    },
  });
}

export type MeetupSpot = { id: string; lga_id: string; name: string; description: string | null; is_active: boolean };

export function useMeetupSpots(lgaId?: string | null, includeInactive = false) {
  return useQuery({
    queryKey: ['meetup', lgaId ?? 'all', includeInactive],
    enabled: !!supabase,
    queryFn: async () => {
      let q = client().from('meetup_locations').select('id, lga_id, name, description, is_active').order('name');
      if (lgaId) q = q.eq('lga_id', lgaId);
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MeetupSpot[];
    },
  });
}

/** Turn "listing_remove" into "Listing remove". */
export function humanise(action: string) {
  const s = action.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
