import { isSecretKey, resolveSupabaseConfig } from '@/lib/supabase-config';

// Builds a fake, unsigned JWT with the given role, just for testing.
function fakeJwt(role: string) {
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ role, iss: 'supabase' })}.signature`;
}

describe('resolveSupabaseConfig', () => {
  it('reports exactly which settings are missing', () => {
    expect(resolveSupabaseConfig(undefined, '')).toEqual({
      status: 'missing',
      missing: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
    });
  });

  it('accepts a public anon key and https URL', () => {
    const cfg = resolveSupabaseConfig('https://abc.supabase.co/', fakeJwt('anon'));
    expect(cfg.status).toBe('ready');
    if (cfg.status === 'ready') expect(cfg.url).toBe('https://abc.supabase.co');
  });

  it('accepts the newer publishable key format', () => {
    expect(resolveSupabaseConfig('https://abc.supabase.co', 'sb_publishable_xyz').status).toBe('ready');
  });

  it('REFUSES a service-role key in the app', () => {
    const cfg = resolveSupabaseConfig('https://abc.supabase.co', fakeJwt('service_role'));
    expect(cfg.status).toBe('invalid');
  });

  it('REFUSES the newer secret key format in the app', () => {
    expect(isSecretKey('sb_secret_abc123')).toBe(true);
    expect(resolveSupabaseConfig('https://abc.supabase.co', 'sb_secret_abc123').status).toBe('invalid');
  });

  it('rejects non-https and malformed URLs', () => {
    expect(resolveSupabaseConfig('http://abc.supabase.co', 'sb_publishable_x').status).toBe('invalid');
    expect(resolveSupabaseConfig('not a url', 'sb_publishable_x').status).toBe('invalid');
  });
});
