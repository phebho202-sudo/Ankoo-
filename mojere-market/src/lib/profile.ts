import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type LocationRow = {
  id: string;
  slug: string;
  name: string;
  kind: 'lga' | 'town';
  parent_id: string | null;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  lga_id: string | null;
  town_id: string | null;
  neighbourhood: string | null;
  account_status: 'active' | 'suspended';
  created_at: string;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase;
}

/** Ondo State LGAs and towns from the database (admins can add more). */
export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    enabled: !!supabase,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await requireClient()
        .from('locations')
        .select('id, slug, name, kind, parent_id')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data ?? []) as LocationRow[];
    },
  });
}

export function useMyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!supabase && !!userId,
    queryFn: async () => {
      const { data, error } = await requireClient()
        .from('user_profiles')
        .select('id, display_name, avatar_path, bio, lga_id, town_id, neighbourhood, account_status, created_at')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileRow | null) ?? null;
    },
  });
}

export type ProfileUpdate = {
  display_name: string;
  bio: string | null;
  lga_id: string;
  town_id: string | null;
  neighbourhood: string | null;
};

export function useSaveProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProfileUpdate) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Please log in again.');
      // upsert: also covers people whose account existed before Mojere Market.
      const { error } = await requireClient()
        .from('user_profiles')
        .upsert({ id: userId, ...values }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
