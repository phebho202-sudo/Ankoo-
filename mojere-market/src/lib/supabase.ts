import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { supabaseConfig } from './supabase-config';

/**
 * The single Supabase client used by the whole app, or `null` when the
 * project is not configured yet. Screens must handle `null` by showing a
 * setup message instead of pretending to work.
 */
export const supabase: SupabaseClient | null =
  supabaseConfig.status === 'ready'
    ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          // Keep users signed in between app launches.
          storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Refresh the login token only while the app is open, as Supabase recommends
// for React Native. This also handles sessions that expired in the background.
if (supabase && Platform.OS !== 'web') {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}

export type ConnectionCheck =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Real connection test: asks the Supabase Auth service on your project
 * whether it is healthy. Uses only the public anon key.
 */
export async function checkSupabaseConnection(): Promise<ConnectionCheck> {
  if (supabaseConfig.status !== 'ready') {
    return { ok: false, message: 'Supabase is not configured yet. See the setup notice.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${supabaseConfig.url}/auth/v1/health`, {
      headers: { apikey: supabaseConfig.anonKey },
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, message: 'Connected to your Supabase project.' };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Supabase rejected the key. Check EXPO_PUBLIC_SUPABASE_ANON_KEY.' };
    }
    return { ok: false, message: `Supabase answered with an error (code ${res.status}).` };
  } catch {
    return {
      ok: false,
      message: 'Could not reach Supabase. Check your internet connection and the project URL.',
    };
  } finally {
    clearTimeout(timer);
  }
}
