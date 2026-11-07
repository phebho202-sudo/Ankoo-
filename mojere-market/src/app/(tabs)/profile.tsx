import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';

import { Logo } from '@/components/logo';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { INITIAL_CATEGORIES } from '@/constants/catalog';
import { ONDO_LGAS } from '@/constants/ondo';
import { checkSupabaseConnection, type ConnectionCheck } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/supabase-config';
import { spacing } from '@/theme';

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

      <Card>
        <AppText variant="title">Your account</AppText>
        <AppText muted>
          Sign-up, login and your public seller profile arrive in Phase 3. Nobody is signed in yet.
        </AppText>
      </Card>

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
