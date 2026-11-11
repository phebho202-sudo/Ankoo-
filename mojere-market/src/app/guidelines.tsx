import { View } from 'react-native';

import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { contactSupport } from '@/lib/support';
import { spacing } from '@/theme';

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: 'Be honest',
    points: [
      'Use your own, recent photos of the actual item.',
      'Describe the condition truthfully, including faults.',
      'Set a real price. Do not post the same item many times.',
    ],
  },
  {
    title: 'Not allowed on Mojere Market',
    points: [
      'Stolen, counterfeit or fake items.',
      'Weapons, ammunition, explosives or illegal drugs.',
      'Prescription medicines, alcohol or tobacco sold without the legal right to do so.',
      'Animals, human body parts, or anything illegal in Nigeria.',
      'Adult content, gambling, or "get rich quick" schemes.',
      'Requests for advance payment for items you do not have.',
    ],
  },
  {
    title: 'Be respectful',
    points: [
      'No insults, threats, harassment or hate speech.',
      'Do not share other people’s private information.',
      'If you are not interested any more, say so politely.',
    ],
  },
  {
    title: 'Trade safely',
    points: [
      'Meet in busy public places during the day.',
      'Inspect the item before paying.',
      'Confirm money is really in your account before handing over an item. Screenshots and SMS alerts can be faked.',
      'Never share OTPs, PINs or passwords. Mojere Market staff will never ask for them.',
      'Ignore requests for "delivery", "verification" or "release" fees, and unexpected payment links.',
      'Never refund an "overpayment". Ask the buyer to cancel and pay the correct amount.',
    ],
  },
  {
    title: 'What happens if rules are broken',
    points: [
      'Listings can be rejected or removed.',
      'Accounts can be suspended, especially for scams, threats or repeated problems.',
      'Serious crimes may be reported to the police.',
    ],
  },
];

export default function GuidelinesScreen() {
  return (
    <Screen>
      <AppText muted>{BRAND.name} works because buyers and sellers in Ondo State can trust each other. Please follow these rules.</AppText>
      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <AppText variant="title">{s.title}</AppText>
          <View style={{ gap: spacing.xs }}>
            {s.points.map((p) => (
              <AppText key={p} variant="small">
                • {p}
              </AppText>
            ))}
          </View>
        </Card>
      ))}
      <Notice title="See something wrong?">
        <AppText variant="small">Use “Report this listing” on an item, or ⋮ → Report in a chat. Reports are private.</AppText>
      </Notice>
      <Card>
        <AppText variant="title">Contact us</AppText>
        <AppText variant="small">Questions or problems? Email {BRAND.supportEmail}.</AppText>
        <Button label="Contact support" kind="outline" onPress={() => void contactSupport()} />
      </Card>
    </Screen>
  );
}
