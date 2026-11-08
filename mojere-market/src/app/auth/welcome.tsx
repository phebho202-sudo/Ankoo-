import { router } from 'expo-router';
import { View } from 'react-native';

import { Logo } from '@/components/logo';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
        <Logo size="lg" />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {BRAND.tagline}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          {BRAND.secondaryTagline}
        </AppText>
      </View>

      <SetupNotice />

      <Card>
        <AppText>Sell things you no longer use, find affordable items near you, and meet buyers and sellers across Ondo State.</AppText>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button label="Create an account" onPress={() => router.push('/auth/sign-up')} />
        <Button label="I already have an account" kind="outline" onPress={() => router.push('/auth/sign-in')} />
        <Button
          label="Just browse for now"
          kind="outline"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ borderColor: colors.border }}
        />
      </View>
    </Screen>
  );
}
