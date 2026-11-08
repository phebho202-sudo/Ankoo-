import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  /** True until we know whether someone is signed in. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

/**
 * Keeps track of who is signed in. Supabase stores the login on the phone and
 * refreshes it automatically; if it expires or the user signs out elsewhere,
 * `session` becomes null and screens switch to their signed-out state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: !!supabase });

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, loading: false });
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Turn Supabase's technical error messages into plain, helpful ones. */
export function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Enter the code we sent you.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try logging in instead.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('invalid otp'))
    return 'That code is wrong or has expired. Request a new code and try again.';
  if (m.includes('error sending') || m.includes('smtp'))
    return 'We could not send the email right now. Please try again in a few minutes.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return 'No internet connection. Check your data or Wi-Fi and try again.';
  if (m.includes('should be different')) return 'Choose a password different from your old one.';
  if (m.includes('weak') || m.includes('password should'))
    return 'That password is too weak. Use a longer password with letters and numbers.';
  return message || 'Something went wrong. Please try again.';
}
