import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { SetupNotice } from '@/components/setup-notice';
import { AppText, Card, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme';

export default function SellScreen() {
  return (
    <Screen>
      <AppText variant="heading">Sell on Mojere Market</AppText>
      <AppText muted>Your unused items could make someone else’s day.</AppText>
      <SetupNotice />

      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Ionicons name="pricetag-outline" size={24} color={colors.accent} />
          <AppText variant="title">Sell an item</AppText>
        </View>
        <AppText muted>
          Add photos, a title, category, condition, price in Naira and your area — then preview
          and publish. Standard listings are free.
        </AppText>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Ionicons name="home-outline" size={24} color={colors.accent} />
          <AppText variant="title">Declutter My Home</AppText>
        </View>
        <AppText muted>
          Walk through your home, photograph several unwanted items, save them as drafts, review
          them together and publish the ones you choose.
        </AppText>
      </Card>

      <AppText variant="caption">
        Selling and decluttering open in Phase 5, once sign-in (Phase 3) is working, because every
        listing must belong to a real, signed-in seller.
      </AppText>
    </Screen>
  );
}
