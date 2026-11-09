import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { AdminGate, ReasonSheet } from '@/components/admin-ui';
import { Chip } from '@/components/filter-sheet';
import { ListingPhoto } from '@/components/listing-card';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { useAdminAction, useAdminListings, type AdminListing, type ListingQueue } from '@/lib/admin';
import { formatNaira } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { colors, radius, spacing } from '@/theme';

type Decision = 'approve' | 'reject' | 'remove' | 'restore';
const QUEUES: { value: ListingQueue; label: string }[] = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'live', label: 'Live' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'removed', label: 'Removed' },
];

function Row({ l, onDecide }: { l: AdminListing; onDecide: (d: Decision) => void }) {
  const cover = [...l.listing_images].sort((a, b) => a.position - b.position)[0]?.storage_path;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${l.title}`}
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
        style={{ flexDirection: 'row', gap: spacing.md }}>
        <ListingPhoto path={cover} style={{ width: 72, height: 72, borderRadius: radius.sm }} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '700' }} numberOfLines={2}>
            {l.title}
          </AppText>
          <AppText variant="small">{formatNaira(l.price_kobo)}</AppText>
          <AppText variant="caption">
            by {l.seller?.display_name ?? 'unknown'} · {timeAgo(l.created_at)} · {l.status} / {l.moderation_status}
          </AppText>
          {l.moderation_note ? <AppText variant="caption">Note: {l.moderation_note}</AppText> : null}
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {l.moderation_status !== 'approved' ? <Button label="Approve" onPress={() => onDecide('approve')} style={{ flexGrow: 1, minHeight: 40 }} /> : null}
        {l.moderation_status !== 'rejected' && l.status !== 'removed' ? (
          <Button label="Reject" kind="outline" onPress={() => onDecide('reject')} style={{ flexGrow: 1, minHeight: 40 }} />
        ) : null}
        {l.status !== 'removed' ? (
          <Button label="Remove" kind="outline" onPress={() => onDecide('remove')} style={{ flexGrow: 1, minHeight: 40, borderColor: colors.danger }} />
        ) : (
          <Button label="Restore (as paused)" kind="outline" onPress={() => onDecide('restore')} style={{ flexGrow: 1, minHeight: 40 }} />
        )}
      </View>
    </Card>
  );
}

function Listings() {
  const [queue, setQueue] = useState<ListingQueue>('pending');
  const list = useAdminListings(queue);
  const action = useAdminAction();
  const [pending, setPending] = useState<{ listing: AdminListing; decision: Decision } | null>(null);

  const labels: Record<Decision, string> = {
    approve: 'Approve listing',
    reject: 'Reject listing (seller can edit and resubmit)',
    remove: 'Remove listing (seller cannot edit it)',
    restore: 'Restore listing as paused',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {QUEUES.map((q) => (
              <Chip key={q.value} label={q.label} selected={queue === q.value} onPress={() => setQueue(q.value)} />
            ))}
          </View>
        }
        renderItem={({ item }) => <Row l={item} onDecide={(decision) => setPending({ listing: item, decision })} />}
        ListEmptyComponent={
          list.isLoading ? <ActivityIndicator color={colors.primary} /> : list.isError ? <Notice tone="danger" title="Could not load listings." /> : <AppText muted>Nothing here.</AppText>
        }
      />
      {pending ? (
        <ReasonSheet
          title={labels[pending.decision]}
          confirmLabel={labels[pending.decision].split(' (')[0] ?? 'Confirm'}
          danger={pending.decision === 'remove'}
          required={pending.decision !== 'approve'}
          onClose={() => setPending(null)}
          onConfirm={(reason) =>
            action.mutateAsync({
              fn: 'mm_admin_moderate_listing',
              args: { p_listing_id: pending.listing.id, p_decision: pending.decision, p_reason: reason || null },
            })
          }
        />
      ) : null}
    </View>
  );
}

export default function AdminListingsScreen() {
  return (
    <AdminGate>
      <Listings />
    </AdminGate>
  );
}
