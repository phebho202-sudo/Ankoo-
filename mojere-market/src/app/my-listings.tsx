import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/filter-sheet';
import { ListingPhoto } from '@/components/listing-card';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { STATUS_LABELS } from '@/lib/declutter';
import { formatNaira } from '@/lib/format';
import { useListingAction, useMyListings, type MyListing } from '@/lib/selling';
import { timeAgo } from '@/lib/time';
import { colors, radius, spacing } from '@/theme';

type Tab = 'live' | 'draft' | 'paused' | 'sold';
const TABS: { value: Tab; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'draft', label: 'Drafts' },
  { value: 'paused', label: 'Paused' },
  { value: 'sold', label: 'Sold' },
];

function inTab(l: MyListing, tab: Tab) {
  if (tab === 'live') return l.status === 'active' || l.status === 'reserved';
  if (tab === 'sold') return l.status === 'sold';
  if (tab === 'paused') return l.status === 'paused' || l.status === 'removed';
  return l.status === 'draft';
}

function Row({ l }: { l: MyListing }) {
  const action = useListingAction();
  const [error, setError] = useState<string | null>(null);

  async function run(a: 'pause' | 'resume' | 'sold' | 'delete') {
    setError(null);
    try {
      await action.mutateAsync({ id: l.id, action: a });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
    }
  }

  function confirm(title: string, message: string, a: 'sold' | 'delete') {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: a === 'delete' ? 'Delete' : 'Mark as sold', style: a === 'delete' ? 'destructive' : 'default', onPress: () => void run(a) },
    ]);
  }

  const review =
    l.moderation_status === 'pending'
      ? 'Waiting for review'
      : l.moderation_status === 'rejected'
        ? `Not approved${l.moderation_note ? `: ${l.moderation_note}` : ''}`
        : null;

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${l.title}`}
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
        style={{ flexDirection: 'row', gap: spacing.md }}>
        <ListingPhoto path={l.listing_images[0]?.storage_path} style={styles.thumb} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '700' }} numberOfLines={2}>
            {l.title}
          </AppText>
          <AppText>{formatNaira(l.price_kobo)}</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={styles.status}>
              <AppText variant="caption" style={{ fontWeight: '700', color: colors.primary }}>
                {STATUS_LABELS[l.status]}
              </AppText>
            </View>
            {l.status !== 'draft' ? (
              <AppText variant="caption">
                <Ionicons name="eye-outline" size={12} /> {l.view_count} view{l.view_count === 1 ? '' : 's'}
              </AppText>
            ) : null}
            <AppText variant="caption">{timeAgo(l.published_at ?? l.created_at)}</AppText>
          </View>
        </View>
      </Pressable>
      {review ? (
        <AppText variant="caption" style={{ color: l.moderation_status === 'rejected' ? colors.danger : colors.warning }}>
          {review}
        </AppText>
      ) : null}
      {error ? <Notice tone="danger" title={error} /> : null}

      {l.status !== 'removed' ? (
        <View style={styles.actions}>
          <Button label="Edit" kind="outline" onPress={() => router.push({ pathname: '/listing-editor', params: { id: l.id } })} style={styles.action} />
          {l.status === 'active' && l.moderation_status === 'approved' ? (
            <Button
              label="Promote"
              kind="accent"
              onPress={() => router.push({ pathname: '/promote/[id]', params: { id: l.id } })}
              style={styles.action}
            />
          ) : null}
          {l.status === 'active' ? (
            <Button label="Pause" kind="outline" onPress={() => void run('pause')} style={styles.action} disabled={action.isPending} />
          ) : null}
          {l.status === 'paused' ? (
            <Button label="Show again" kind="outline" onPress={() => void run('resume')} style={styles.action} disabled={action.isPending} />
          ) : null}
          {l.status === 'active' || l.status === 'reserved' ? (
            <Button
              label="Mark as sold"
              kind="outline"
              onPress={() => confirm('Mark as sold?', 'Buyers will see this item as sold.', 'sold')}
              style={styles.action}
              disabled={action.isPending}
            />
          ) : null}
          <Button
            label="Delete"
            kind="outline"
            onPress={() => confirm('Delete this listing?', 'This removes it and its photos for good.', 'delete')}
            style={{ ...styles.action, borderColor: colors.danger }}
            disabled={action.isPending}
          />
        </View>
      ) : (
        <AppText variant="caption" style={{ color: colors.danger }}>
          Removed by Mojere Market. Contact support if you think this is a mistake.
        </AppText>
      )}
    </Card>
  );
}

export default function MyListingsScreen() {
  const listings = useMyListings();
  const [tab, setTab] = useState<Tab>('live');
  const items = useMemo(() => (listings.data ?? []).filter((l) => inTab(l, tab)), [listings.data, tab]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <Chip
                key={t.value}
                label={`${t.label} (${(listings.data ?? []).filter((l) => inTab(l, t.value)).length})`}
                selected={tab === t.value}
                onPress={() => setTab(t.value)}
              />
            ))}
          </View>
        }
        renderItem={({ item }) => <Row l={item} />}
        ListEmptyComponent={
          listings.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : listings.isError ? (
            <Notice tone="danger" title="Could not load your listings. Pull down to try again." />
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <AppText variant="title">Nothing here yet</AppText>
              <Button label="Sell an item" kind="accent" onPress={() => router.push('/listing-editor')} />
            </Card>
          )
        }
        refreshControl={
          <RefreshControl refreshing={listings.isRefetching} onRefresh={() => void listings.refetch()} tintColor={colors.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  status: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, minHeight: 40, paddingHorizontal: spacing.md },
});
