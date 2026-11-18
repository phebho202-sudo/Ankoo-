import { router } from 'expo-router';
import { View } from 'react-native';

import { Logo } from '@/components/logo';
import { PageTitle } from '@/components/page-title';
import { SiteLinks } from '@/components/site-links';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { spacing } from '@/theme';

const STEPS = [
  { title: 'Snap and list', text: 'Take a few photos, add a price and your area. It takes about a minute.' },
  { title: 'Chat and agree', text: 'Buyers message you or make an offer. Accept, counter or decline in the chat.' },
  { title: 'Meet safely', text: 'Meet in a busy public place, check the item, and confirm the money before handing over.' },
];

export default function AboutScreen() {
  return (
    <Screen>
      <PageTitle title="About" />
      <View style={{ alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md }}>
        <Logo />
        <AppText variant="display" style={{ textAlign: 'center' }}>
          {BRAND.tagline}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          {BRAND.secondaryTagline} The local marketplace for {BRAND.region}.
        </AppText>
      </View>
      <Button label="Start browsing" onPress={() => router.push('/')} />
      <Button label="Sell an item" kind="outline" onPress={() => router.push('/sell')} />

      <AppText variant="heading">How it works</AppText>
      {STEPS.map((s, i) => (
        <Card key={s.title}>
          <AppText variant="title">
            {i + 1}. {s.title}
          </AppText>
          <AppText>{s.text}</AppText>
        </Card>
      ))}

      <Card>
        <AppText variant="title">Declutter My Home</AppText>
        <AppText>
          Moving out or clearing space? Add many items at once as drafts, then publish them together. {BRAND.campaign}
        </AppText>
      </Card>
      <Card>
        <AppText variant="title">Built for safety</AppText>
        <AppText>
          Report and block buttons on every listing and chat, safe meetup spots, and a team that reviews reports. {BRAND.name}{' '}
          never holds your money and will never ask for your PIN or codes.
        </AppText>
      </Card>
      <Card>
        <AppText variant="title">Get the app</AppText>
        <AppText>
          The {BRAND.name} apps for Android and iPhone are coming soon. Until then, you can use {BRAND.name} right here in your
          browser.
        </AppText>
      </Card>
      <SiteLinks />
    </Screen>
  );
}
