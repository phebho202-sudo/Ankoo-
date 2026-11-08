import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText, Notice } from './ui';

const TIPS = [
  'Meet in a busy public place in daylight. Take someone with you if you can.',
  'Check the item carefully before you pay.',
  'Confirm the money is really in your account before handing over an item. Bank alerts and transfer screenshots can be faked.',
  'Never share OTPs, PINs or passwords. Mojere Market will never ask for them.',
  'Do not pay “delivery”, “verification” or “release” fees, and ignore payment links you did not expect.',
  'Be careful with overpayments: never refund “extra” money that was sent by mistake.',
  'Keep the conversation in Mojere Market where possible.',
];

export function SafetyTips() {
  return (
    <Notice tone="warning" title="Stay safe when buying and selling">
      <View style={{ gap: spacing.xs }}>
        {TIPS.map((tip) => (
          <View key={tip} style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.warning} style={{ marginTop: 2 }} />
            <AppText variant="small" style={{ flex: 1 }}>
              {tip}
            </AppText>
          </View>
        ))}
        <AppText variant="small" style={{ fontWeight: '700', marginTop: spacing.xs }}>
          Mojere Market does not hold or protect payments between buyers and sellers.
        </AppText>
      </View>
    </Notice>
  );
}
