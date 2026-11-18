import { View } from 'react-native';

import { SiteLinks } from '@/components/site-links';
import { PageTitle } from '@/components/page-title';
import { AppText, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { spacing } from '@/theme';

/**
 * Public Privacy Policy (also the web page used for the App Store and Google Play).
 * Plain-language text describing what the app really does. Must be reviewed by a
 * Nigerian lawyer (Nigeria Data Protection Act 2023) and kept up to date.
 */
const operator = BRAND.legalOperator || BRAND.name;

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'Who is responsible for your data',
    paragraphs: [`${operator}, ${BRAND.region}. Contact: ${BRAND.supportEmail}.`],
  },
  {
    title: '1. What we collect',
    paragraphs: [
      'Account: your email address, your password (stored only in scrambled form), your display name and the date you accepted our terms.',
      'Profile: an optional bio and photo, and the area you choose (Local Government Area, town and neighbourhood). We do not use your phone’s GPS.',
      'Listings: item titles, descriptions, prices, condition, category, area and photos.',
      'Messages and offers: messages you send to other users, offers, counteroffers and handover confirmations.',
      'Reviews and reports: ratings and comments you leave, and reports you send about listings, messages or people.',
      'Business storefront (optional): business name, description, logo, and the phone, WhatsApp and email details you choose to show.',
      'Saved items, people you block, and your notification settings.',
      'Notifications we create for you, and, if you allow alerts in an installed app, a push notification identifier and whether your phone is an iPhone or Android.',
      'Listing views: we count how many times a listing is viewed. The count is not linked to who viewed it.',
      'Payments (only if online payments are switched on): the amount, purpose and status, and the reference from our payment provider. We never see or store card details.',
      'We do not collect your contacts, precise location or advertising identifiers, and we do not track you across other apps or websites.',
    ],
  },
  {
    title: '2. Why we use it',
    paragraphs: [
      'To create and run your account and show your listings, profile and storefront to other users (to provide the service you signed up for).',
      'To deliver messages, offers, notifications and account emails such as sign-up and password-reset codes.',
      'To keep the marketplace safe: reviewing reports, removing prohibited items, suspending accounts and keeping a record of staff actions (our legitimate interests and legal duties).',
      'To keep payment records for accounting and tax (legal duty).',
      'Phone alerts are optional and use your consent, which you can withdraw at any time in your phone settings or in Profile → Notification settings.',
      'We do not sell your personal data and we do not use it for advertising.',
    ],
  },
  {
    title: '3. What other users can see',
    paragraphs: [
      'Other users can see your display name, general area, listings, the storefront details you choose to show, and reviews. They cannot see your email address unless you share it.',
      'Messages are visible only to the people in the conversation. Our staff may read a reported message when investigating a report.',
    ],
  },
  {
    title: '4. Who we share data with',
    paragraphs: [
      'Supabase stores our database, photos and login system. Google (Gmail) sends our account emails. Expo delivers phone alerts for installed apps. Paystack processes payments, only if online payments are switched on. Apple and Google provide the app stores.',
      'Some of these providers store data outside Nigeria. Where they do, we rely on the safeguards allowed under the Nigeria Data Protection Act 2023.',
      'We may disclose information when required by law, or to the police to investigate fraud or a crime.',
    ],
  },
  {
    title: '5. How long we keep it',
    paragraphs: [
      'We keep your data while your account exists. When you delete your account we delete your profile, login, listings, photos, messages, offers, reviews, saved items, notifications and storefront.',
      'Payment records are kept for 6 years for accounting and legal reasons, without your name or contact details. A record that an account was deleted is kept for security.',
    ],
  },
  {
    title: '6. Your rights',
    paragraphs: [
      'Under the Nigeria Data Protection Act 2023 you can ask to access a copy of your data, correct it, delete it, object to or restrict certain uses, withdraw consent, and receive your data in a portable format.',
      'Delete your account yourself in the app (Profile → Delete my account) or see the “Delete account” page. Edit your details in Profile → Edit profile.',
      `For anything else, email ${BRAND.supportEmail}. We aim to reply within 30 days. You can also complain to the Nigeria Data Protection Commission (NDPC).`,
    ],
  },
  { title: '7. Age', paragraphs: [`${BRAND.name} is for people aged 18 and over. We do not knowingly collect data from children.`] },
  {
    title: '8. Security',
    paragraphs: [
      'We use encrypted connections and access rules that stop users from reading other people’s private data, and we never store card details. No system is perfectly secure, so use a strong password and never share your login codes.',
    ],
  },
  {
    title: '9. Changes',
    paragraphs: ['If we change this policy we will update the date at the top, and tell you in the app if the change is important.'],
  },
];

export default function PrivacyScreen() {
  return (
    <Screen>
      <PageTitle title="Privacy Policy" />
      <AppText variant="heading">{BRAND.name} Privacy Policy</AppText>
      <AppText variant="caption">Last updated: {BRAND.privacyUpdated}</AppText>
      <AppText>
        {BRAND.name} is a marketplace where people in {BRAND.region} list items and contact each other to buy and sell. This
        policy explains what personal data we collect, why, who we share it with, and your rights.
      </AppText>
      {SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: spacing.xs }}>
          <AppText variant="title">{s.title}</AppText>
          {s.paragraphs.map((p) => (
            <AppText key={p.slice(0, 40)} variant="small">
              {p}
            </AppText>
          ))}
        </View>
      ))}
      <SiteLinks />
    </Screen>
  );
}
