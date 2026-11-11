import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Logo } from '@/components/logo';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { INITIAL_CATEGORIES } from '@/constants/catalog';
import { ONDO_LGAS } from '@/constants/ondo';
import { useStaffRole } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { useLocations, useMyProfile } from '@/lib/profile';
import { contactSupport } from '@/lib/support';
import { checkSupabaseConnection, supabase, type ConnectionCheck } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/supabase-config';
import { colors, spacing } from '@/theme';

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}

function AccountCard() {
  const { session, loading } = useAuth();
  const profile = useMyProfile();
  const locations = useLocations();
  const [signingOut, setSigningOut] = useState(false);
  const role = useStaffRole();

  if (loading || (session && profile.isLoading)) {
    return (
      <Card>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <AppText variant="title">Join Mojere Market</AppText>
        <AppText muted>Create a free account to sell items, save favourites and message sellers.</AppText>
        <Button label="Create an account" onPress={() => router.push('/auth/sign-up')} disabled={!supabase} />
        <Button label="Log in" kind="outline" onPress={() => router.push('/auth/sign-in')} disabled={!supabase} />
      </Card>
    );
  }

  const p = profile.data;
  const placeName = (id: string | null | undefined) => locations.data?.find((l) => l.id === id)?.name;
  const area = [p?.neighbourhood, placeName(p?.town_id), placeName(p?.lga_id)].filter(Boolean).join(', ');
  const emailVerified = !!session.user.email_confirmed_at;

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  return (
    <Card>
      {profile.isError ? (
        <Notice tone="danger" title="Could not load your profile. Check your connection." />
      ) : null}
      {p?.account_status === 'suspended' ? (
        <Notice tone="danger" title="Your account is suspended">
          <AppText variant="small">You cannot post listings or send messages. Contact Mojere Market support at {BRAND.supportEmail}.</AppText>
        </Notice>
      ) : null}

      <AppText variant="title">{p?.display_name ?? 'Your profile'}</AppText>
      <AppText muted>{area || 'Location not set yet'}</AppText>
      {p?.bio ? <AppText>{p.bio}</AppText> : null}
      {p?.created_at ? <AppText variant="caption">Member since {formatJoined(p.created_at)}</AppText> : null}

      <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons
            name={emailVerified ? 'checkmark-circle' : 'alert-circle-outline'}
            size={18}
            color={emailVerified ? colors.success : colors.warning}
          />
          <AppText variant="small">{emailVerified ? 'Email verified' : 'Email not verified yet'}</AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="call-outline" size={18} color={colors.textMuted} />
          <AppText variant="small" muted>
            Phone verification is not available yet (needs an SMS provider).
          </AppText>
        </View>
      </View>

      {!p?.lga_id ? <Notice tone="warning" title="Add your location so buyers know where you are." /> : null}

      <Button label="Edit profile" onPress={() => router.push('/edit-profile')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label="My listings" kind="outline" onPress={() => router.push('/my-listings')} style={{ flexGrow: 1 }} />
        <Button label="Mojere Market Business" kind="outline" onPress={() => router.push('/business')} style={{ flexGrow: 1 }} />
        <Button label="Saved items" kind="outline" onPress={() => router.push('/favourites')} style={{ flexGrow: 1 }} />
        <Button label="Notifications" kind="outline" onPress={() => router.push('/notifications')} style={{ flexGrow: 1 }} />
        <Button label="Notification settings" kind="outline" onPress={() => router.push('/notification-settings')} style={{ flexGrow: 1 }} />
      </View>
      {role.data?.isStaff ? (
        <Button label="Admin dashboard" kind="accent" onPress={() => router.push('/admin')} />
      ) : null}
      <Button label="Community guidelines" kind="outline" onPress={() => router.push('/guidelines')} />
      <Button label="Contact support" kind="outline" onPress={() => void contactSupport()} />
      <Button label="Log out" kind="outline" onPress={signOut} loading={signingOut} />
      <Button label="Delete my account" kind="outline" onPress={() => router.push('/delete-account')} />
    </Card>
  );
}

export default function ProfileScreen() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ConnectionCheck | null>(null);

  async function runCheck() {
    setChecking(true);
    setResult(await checkSupabaseConnection());
    setChecking(false);
  }

  return (
    <Screen>
      <AppText variant="heading">Profile</AppText>
      <SetupNotice />

      <AccountCard />

      <Card>
        <AppText variant="title">App setup check</AppText>
        <AppText variant="small" muted>
          For the founder: confirms this app can talk to your Supabase project.
        </AppText>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="small">
            Database settings: {supabaseConfig.status === 'ready' ? 'found' : 'not set yet'}
          </AppText>
          <AppText variant="small">Ondo State LGAs loaded: {ONDO_LGAS.length}</AppText>
          <AppText variant="small">Categories loaded: {INITIAL_CATEGORIES.length}</AppText>
          <AppText variant="small">App version: {Constants.expoConfig?.version ?? 'unknown'}</AppText>
        </View>
        <Button
          label="Test Supabase connection"
          kind="outline"
          onPress={runCheck}
          loading={checking}
          disabled={supabaseConfig.status !== 'ready'}
        />
        {result ? (
          <Notice tone={result.ok ? 'info' : 'danger'} title={result.ok ? 'Success' : 'Not connected'}>
            <AppText variant="small">{result.message}</AppText>
          </Notice>
        ) : null}
      </Card>

      <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg }}>
        <Logo />
        <AppText variant="caption">{BRAND.region}</AppText>
      </View>
    </Screen>
  );
}
