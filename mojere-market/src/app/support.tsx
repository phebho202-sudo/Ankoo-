import { Link } from 'expo-router';
import { View } from 'react-native';

import { SiteLinks } from '@/components/site-links';
import { PageTitle } from '@/components/page-title';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { contactSupport } from '@/lib/support';
import { colors, spacing } from '@/theme';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'I did not get my 6-digit code',
    a: 'Check your spam or promotions folder. Codes can take a few minutes. On the code screen, tap “Send a new code”.',
  },
  {
    q: 'I forgot my password',
    a: 'On the log-in screen, tap “Forgot your password?” and follow the steps. We will email you a code.',
  },
  {
    q: 'Someone tried to scam me',
    a: 'Stop replying, do not send money, and tap “Report” on the listing or in the chat. If you lost money, also report to the police and your bank.',
  },
  {
    q: 'How do I delete my account?',
    a: 'In the app: Profile → Delete my account. You can also see the Delete account page.',
  },
  {
    q: `Does ${BRAND.name} hold my money?`,
    a: `No. ${BRAND.name} does not hold or protect payments between buyers and sellers. Meet in a busy public place and confirm the money is really in your account before handing over an item.`,
  },
];

export default function SupportScreen() {
  return (
    <Screen>
      <PageTitle title="Help and support" />
      <AppText variant="heading">Help and support</AppText>
      <Card>
        <AppText variant="title">Contact us</AppText>
        <AppText>
          Email <AppText style={{ fontWeight: '700' }}>{BRAND.supportEmail}</AppText>. Tell us your account email and what
          happened. We never ask for your password, codes or bank PIN.
        </AppText>
        <Button label="Email support" onPress={() => void contactSupport()} />
      </Card>
      {FAQ.map((f) => (
        <View key={f.q} style={{ gap: spacing.xs }}>
          <AppText variant="title">{f.q}</AppText>
          <AppText variant="small">{f.a}</AppText>
        </View>
      ))}
      <AppText variant="small">
        Read our{' '}
        <Link href="/guidelines" style={{ color: colors.primary, fontWeight: '700' }}>
          community guidelines
        </Link>{' '}
        for safe trading tips.
      </AppText>
      <SiteLinks />
    </Screen>
  );
}
