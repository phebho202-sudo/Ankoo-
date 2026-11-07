/**
 * Reads and checks the Supabase settings the app is allowed to use.
 *
 * Only two values belong in the mobile app:
 *   EXPO_PUBLIC_SUPABASE_URL       e.g. https://abcdefgh.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY  the "anon" or "publishable" key
 *
 * Anything starting with EXPO_PUBLIC_ is bundled into the app and can be read
 * by anyone who downloads it. That is fine for the anon/publishable key
 * (Row Level Security protects the data), but it would be a disaster for the
 * service-role / secret key, so we refuse to start with one.
 */

export type SupabaseConfig =
  | { status: 'ready'; url: string; anonKey: string }
  | { status: 'missing'; missing: string[] }
  | { status: 'invalid'; problem: string };

/** Decode the middle part of a JWT without verifying it (we only read the role). */
function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = globalThis.atob ? globalThis.atob(padded) : '';
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  return jwtRole(key) === 'service_role';
}

export function resolveSupabaseConfig(
  url: string | undefined,
  anonKey: string | undefined,
): SupabaseConfig {
  const cleanUrl = url?.trim() ?? '';
  const cleanKey = anonKey?.trim() ?? '';

  const missing: string[] = [];
  if (!cleanUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!cleanKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length) return { status: 'missing', missing };

  if (isSecretKey(cleanKey)) {
    return {
      status: 'invalid',
      problem:
        'The key in EXPO_PUBLIC_SUPABASE_ANON_KEY is a SECRET (service-role) key. ' +
        'Remove it now and use the "anon" / "publishable" key instead.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    return { status: 'invalid', problem: 'EXPO_PUBLIC_SUPABASE_URL is not a valid web address.' };
  }
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isLocal) {
    return { status: 'invalid', problem: 'EXPO_PUBLIC_SUPABASE_URL must start with https://' };
  }

  return { status: 'ready', url: cleanUrl.replace(/\/+$/, ''), anonKey: cleanKey };
}

/**
 * Expo replaces `process.env.EXPO_PUBLIC_*` with the values from your `.env`
 * file when it builds the app. They must be written out in full like this.
 */
export const supabaseConfig = resolveSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
