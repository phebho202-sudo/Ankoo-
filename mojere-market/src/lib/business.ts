import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { compressPhoto } from './photos';
import { supabase } from './supabase';

/** Payments are only offered when explicitly switched on (see docs/PAYMENTS.md). */
export const paymentsEnabled = process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === 'true';

/**
 * Paid promotions and paid business plans are digital services. Apple only allows
 * those to be sold inside iPhone apps through Apple's own In-App Purchase, which
 * Mojere Market does not use, so on iPhones these paid options are not shown at all.
 * Buying and selling physical items between people is not affected.
 */
export function paidFeaturesOnThisDevice(): boolean {
  return Platform.OS !== 'ios';
}

export type BusinessPlan = {
  id: string;
  code: string;
  name: string;
  price_kobo: number;
  max_active_listings: number | null;
  features: string[];
};

export type PromotionPackage = {
  id: string;
  code: string;
  name: string;
  kind: 'featured' | 'homepage' | 'assisted_listing';
  duration_days: number | null;
  price_kobo: number;
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  logo_path: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  lga_id: string | null;
  town_id: string | null;
  status: 'active' | 'suspended';
};

export type Subscription = {
  id: string;
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  plan: { code: string; name: string; price_kobo: number; max_active_listings: number | null } | null;
};

export type MyPromotion = {
  id: string;
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled' | 'refunded';
  price_kobo: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  listing: { id: string; title: string } | null;
  package: { name: string; duration_days: number | null } | null;
};

const BUSINESS_COLUMNS =
  'id, owner_id, name, slug, description, category_id, logo_path, contact_phone, contact_email, whatsapp, lga_id, town_id, status';

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

/** "Akure Gadgets & Co." → "akure-gadgets-co" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/** Turn a Nigerian number like 0803 123 4567 into 2348031234567 for WhatsApp links. */
export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return digits;
}

export function businessLogoUrl(path: string | null | undefined) {
  if (!path || !supabase) return null;
  return supabase.storage.from('business-images').getPublicUrl(path).data.publicUrl;
}

export function usePlans() {
  return useQuery({
    queryKey: ['business-plans'],
    enabled: !!supabase,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await client()
        .from('business_plans')
        .select('id, code, name, price_kobo, max_active_listings, features')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as BusinessPlan[];
    },
  });
}

export function usePackages() {
  return useQuery({
    queryKey: ['promotion-packages'],
    enabled: !!supabase,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await client()
        .from('promotion_packages')
        .select('id, code, name, kind, duration_days, price_kobo')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as PromotionPackage[];
    },
  });
}

export function useMyBusiness() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-business', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const db = client();
      const { data, error } = await db.from('business_profiles').select(BUSINESS_COLUMNS).eq('owner_id', userId!).maybeSingle();
      if (error) throw error;
      const business = data as Business | null;
      if (!business) return { business: null, subscriptions: [] as Subscription[] };
      const { data: subs, error: subError } = await db
        .from('business_subscriptions')
        .select('id, status, starts_at, ends_at, created_at, plan:business_plans(code, name, price_kobo, max_active_listings)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (subError) throw subError;
      return { business, subscriptions: (subs ?? []) as unknown as Subscription[] };
    },
  });
}

export function useBusinessBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['business', slug],
    enabled: !!supabase && !!slug,
    queryFn: async () => {
      const { data, error } = await client().from('business_profiles').select(BUSINESS_COLUMNS).eq('slug', slug!).maybeSingle();
      if (error) throw error;
      return (data as Business | null) ?? null;
    },
  });
}

export function useBusinessOfUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['business-of', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data } = await client().from('business_profiles').select('name, slug').eq('owner_id', userId!).maybeSingle();
      return (data as { name: string; slug: string } | null) ?? null;
    },
  });
}

export type BusinessInput = {
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  contactPhone: string;
  contactEmail: string;
  whatsapp: string;
  lgaId: string | null;
  townId: string | null;
};

export function useSaveBusiness() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { input: BusinessInput; existingId?: string; logoUri?: string | null }) => {
      const userId = session!.user.id;
      const db = client();
      let logoPath: string | undefined;
      if (v.logoUri) {
        const { bytes } = await compressPhoto(v.logoUri);
        logoPath = `${userId}/logo-${Date.now()}.jpg`;
        const { error } = await db.storage.from('business-images').upload(logoPath, bytes, { contentType: 'image/jpeg' });
        if (error) throw new Error(`Logo upload failed: ${error.message}`);
      }
      const row = {
        name: v.input.name.trim(),
        slug: v.input.slug,
        description: v.input.description.trim() || null,
        category_id: v.input.categoryId,
        contact_phone: v.input.contactPhone.trim() || null,
        contact_email: v.input.contactEmail.trim() || null,
        whatsapp: v.input.whatsapp.trim() || null,
        lga_id: v.input.lgaId,
        town_id: v.input.townId,
        ...(logoPath ? { logo_path: logoPath } : {}),
      };
      const { error } = v.existingId
        ? await db.from('business_profiles').update(row).eq('id', v.existingId)
        : await db.from('business_profiles').insert({ ...row, owner_id: userId });
      if (error) {
        if (error.code === '23505') throw new Error('That web name is already taken. Try a different one.');
        throw error;
      }
      if (!v.existingId) {
        const { error: planError } = await db.rpc('mm_request_business_plan', { p_plan_code: 'free' });
        if (planError) throw planError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-business'] }),
  });
}

export function useRequestPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planCode: string) => {
      const { data, error } = await client().rpc('mm_request_business_plan', { p_plan_code: planCode });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-business'] }),
  });
}

export function useMyPromotions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-promotions', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async () => {
      const { data, error } = await client()
        .from('promotions')
        .select('id, status, price_kobo, starts_at, ends_at, created_at, listing:listings(id, title), package:promotion_packages(name, duration_days)')
        .eq('purchaser_id', session!.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MyPromotion[];
    },
  });
}

export function useRequestPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { listingId: string; packageCode: string }) => {
      const { data, error } = await client().rpc('mm_request_promotion', {
        p_listing_id: v.listingId,
        p_package_code: v.packageCode,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-promotions'] }),
  });
}

export type PaymentOutcome = 'paid' | 'failed' | 'pending' | 'not_configured';

/**
 * Start a Paystack payment: the server works out the price and returns a
 * secure Paystack checkout page, which opens in a browser window. Afterwards
 * we check the payment record; it only says "success" once Paystack has
 * confirmed the payment to our server.
 */
export async function payWithPaystack(purpose: 'promotion' | 'business_subscription', targetId: string): Promise<PaymentOutcome> {
  if (!paymentsEnabled) return 'not_configured';
  const db = client();
  const { data, error } = await db.functions.invoke('paystack-initialize', { body: { purpose, targetId } });
  if (error || !data?.authorizationUrl) {
    const message = (data as { message?: string } | null)?.message;
    if ((data as { error?: string } | null)?.error === 'payments_not_configured') return 'not_configured';
    throw new Error(message ?? 'Could not start the payment. Please try again.');
  }
  await WebBrowser.openBrowserAsync(data.authorizationUrl as string);
  return checkPayment(data.reference as string);
}

export async function checkPayment(reference: string, attempts = 10): Promise<PaymentOutcome> {
  const db = client();
  for (let i = 0; i < attempts; i++) {
    const { data } = await db.from('payment_records').select('status').eq('reference', reference).maybeSingle();
    const status = (data as { status: string } | null)?.status;
    if (status === 'success') return 'paid';
    if (status === 'failed' || status === 'abandoned') return 'failed';
    await new Promise((r) => setTimeout(r, 3000));
  }
  return 'pending';
}
