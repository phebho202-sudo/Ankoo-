import { View } from 'react-native';

import { AppText, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { spacing } from '@/theme';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title">{title}</AppText>
      <AppText>{children}</AppText>
    </View>
  );
}

/**
 * DRAFT terms. These must be reviewed by a Nigerian lawyer (including for the
 * Nigeria Data Protection Act 2023) before public launch.
 */
export default function TermsScreen() {
  return (
    <Screen>
      <Notice tone="warning" title="Draft — pending legal review">
        <AppText variant="small">
          These terms are a plain-language draft for testing and will be finalised before public launch.
        </AppText>
      </Notice>

      <Section title="What Mojere Market is">
        {`${BRAND.name} is a place for people in Ondo State to list items for sale and contact each other. We are not the seller of any item and we do not inspect items.`}
      </Section>
      <Section title="Payments between users">
        {`${BRAND.name} does not hold, process or protect payments between buyers and sellers. You arrange payment and handover directly with the other person, at your own risk. Never hand over an item until you have confirmed the money is in your account — not just a screenshot or SMS.`}
      </Section>
      <Section title="Your responsibilities">
        {'Only list items you own and are allowed to sell. Describe items honestly. Do not list illegal, stolen, counterfeit, dangerous or prohibited items. Be respectful in messages. Do not harass, scam or mislead anyone.'}
      </Section>
      <Section title="Safety">
        {'Meet in busy public places during the day. Bring someone with you if you can. Mojere Market staff will never ask for your password, OTP or bank PIN. Report suspicious listings or users in the app.'}
      </Section>
      <Section title="What we can do">
        {'We may remove listings, limit features or suspend accounts that break these rules or put others at risk.'}
      </Section>
      <Section title="Privacy">
        {'We collect your name, email, general location, listings, messages and activity in the app to run the marketplace. Other users see your display name, general area, listings and reviews — never your email, phone number or exact address unless you choose to share them. Messages are visible only to the people in the conversation, and to staff when investigating a report. We do not sell your personal data. You can delete your account and data at any time in Profile → Delete my account. Records of payments are kept for accounting, without your name.'}
      </Section>
    </Screen>
  );
}
