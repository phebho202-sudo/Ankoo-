import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/listing-card';
import { Logo } from '@/components/logo';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { INITIAL_CATEGORIES } from '@/constants/catalog';
import { useListingStrip, type ListingSummary } from '@/lib/listings';
import { useLocations, useMyProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="title">{title}</AppText>
      {onSeeAll ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`See all ${title}`} hitSlop={10} onPress={onSeeAll}>
          <AppText variant="small" style={{ color: colors.primary, fontWeight: '700' }}>
            See all
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Strip({ items }: { items: ListingSummary[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
      {items.map((item) => (
        <ListingCard key={item.id} item={item} width={160} />
      ))}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const profile = useMyProfile();
  const locations = useLocations();
  const myLga = profile.data?.lga_id ?? null;
  const myLgaName = locations.data?.find((l) => l.id === myLga)?.name;

  const featured = useListingStrip('featured', { featuredOnly: true }, 10);
  const nearby = useListingStrip('nearby', { lgaId: myLga }, 10, !!myLga);
  const recent = useListingStrip('recent', {}, 8);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['listings'] });
    setRefreshing(false);
  }

  function submitSearch() {
    router.navigate({ pathname: '/explore', params: { q: search.trim() } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          supabase ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} /> : undefined
        }>
        <View style={{ gap: spacing.xs }}>
          <Logo />
          <AppText muted>{BRAND.tagline}</AppText>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={submitSearch}
            placeholder="What are you looking for?"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            accessibilityLabel="Search Mojere Market"
            maxFontSizeMultiplier={1.6}
            style={styles.searchInput}
          />
        </View>

        <SetupNotice />

        <View style={styles.hero}>
          <AppText variant="title" style={{ color: colors.textOnPrimary }}>
            {BRAND.campaign}
          </AppText>
          <AppText variant="small" style={{ color: colors.primarySoft }}>
            Let’s turn unused items into useful money.
          </AppText>
          <View style={styles.heroButtons}>
            <Button label="Sell an Item" kind="accent" onPress={() => router.push('/listing-editor')} style={{ flex: 1 }} />
            <Button label="Declutter My Home" kind="outline" onPress={() => router.push('/declutter')} style={{ flex: 1 }} />
          </View>
        </View>

        {featured.data && featured.data.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Featured" />
            <Strip items={featured.data} />
          </View>
        ) : null}

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

        {myLga && nearby.data && nearby.data.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title={`Near you${myLgaName ? ` in ${myLgaName}` : ''}`}
              onSeeAll={() => router.navigate({ pathname: '/explore', params: { lga: myLga } })}
            />
            <Strip items={nearby.data} />
          </View>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Recently added"
            onSeeAll={recent.data?.length ? () => router.navigate({ pathname: '/explore', params: {} }) : undefined}
          />
          {recent.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : recent.isError ? (
            <Card>
              <AppText muted>Could not load listings. Pull down to try again.</AppText>
            </Card>
          ) : recent.data && recent.data.length > 0 ? (
            <View style={styles.recentGrid}>
              {recent.data.map((item) => (
                <View key={item.id} style={{ width: '48%', flexGrow: 1, maxWidth: '50%' }}>
                  <ListingCard item={item} />
                </View>
              ))}
            </View>
          ) : (
            <Card>
              <AppText muted>
                No listings yet. Real listings from sellers in Ondo State will appear here — yours could be the
                first!
              </AppText>
            </Card>
          )}
        </View>

        <AppText variant="caption" style={{ textAlign: 'center' }}>
          {BRAND.secondaryTagline}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH,
  },
  searchInput: { flex: 1, fontSize: fontSize.body, color: colors.text, paddingVertical: spacing.sm },
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
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
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
