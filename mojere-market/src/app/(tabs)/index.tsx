import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/logo';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { INITIAL_CATEGORIES } from '@/constants/catalog';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Logo />
        <AppText muted>{BRAND.tagline}</AppText>
      </View>

      <SetupNotice />

      {/* Main actions */}
      <View style={styles.hero}>
        <AppText variant="title" style={{ color: colors.textOnPrimary }}>
          {BRAND.campaign}
        </AppText>
        <AppText variant="small" style={{ color: colors.primarySoft }}>
          Let’s turn unused items into useful money.
        </AppText>
        <View style={styles.heroButtons}>
          <Button label="Sell an Item" kind="accent" onPress={() => router.navigate('/sell')} style={{ flex: 1 }} />
          <Button
            label="Declutter My Home"
            kind="outline"
            onPress={() => router.navigate('/sell')}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {/* Categories */}
      <View style={{ gap: spacing.md }}>
        <AppText variant="title">Browse categories</AppText>
        <View style={styles.grid}>
          {INITIAL_CATEGORIES.map((c) => (
            <Pressable
              key={c.slug}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${c.name}`}
              onPress={() => router.navigate({ pathname: '/explore', params: { category: c.slug } })}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
              <View style={styles.tileIcon}>
                <Ionicons name={c.icon} size={24} color={colors.primary} />
              </View>
              <AppText variant="caption" numberOfLines={2} style={styles.tileLabel}>
                {c.name}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <Card>
        <AppText variant="title">Recently added</AppText>
        <AppText muted>
          No listings yet. Real listings from sellers in Ondo State will appear here once the
          marketplace is live.
        </AppText>
      </Card>

      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {BRAND.secondaryTagline}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  tileIcon: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { textAlign: 'center', color: colors.text },
});
