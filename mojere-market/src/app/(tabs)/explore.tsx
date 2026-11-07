import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SetupNotice } from '@/components/setup-notice';
import { AppText, Card, Screen } from '@/components/ui';
import { INITIAL_CATEGORIES } from '@/constants/catalog';
import { colors, radius, spacing } from '@/theme';

export default function ExploreScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const selected = INITIAL_CATEGORIES.find((c) => c.slug === category);

  return (
    <Screen>
      <AppText variant="heading">Explore</AppText>
      <SetupNotice />

      {selected ? (
        <View style={styles.chip}>
          <Ionicons name={selected.icon} size={16} color={colors.primary} />
          <AppText variant="small" style={{ color: colors.primary, fontWeight: '600' }}>
            {selected.name}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear category filter"
            hitSlop={12}
            onPress={() => router.setParams({ category: undefined })}>
            <Ionicons name="close-circle" size={18} color={colors.primary} />
          </Pressable>
        </View>
      ) : null}

      <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Ionicons name="search-outline" size={40} color={colors.textMuted} />
        <AppText variant="title">No listings to show yet</AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          Search, price filters, location filters and sorting are built in Phase 4, on top of real
          listings stored in your database.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
