import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ListingPhoto } from '@/components/listing-card';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import {
  splitPublishable,
  STATUS_LABELS,
  useCompleteSession,
  useDeclutterSession,
  usePublishDrafts,
  type DeclutterItem,
} from '@/lib/declutter';
import { formatNaira } from '@/lib/format';
import { missingForPublish } from '@/lib/selling';
import { colors, radius, spacing } from '@/theme';

function ItemRow({
  item,
  selectable,
  selected,
  onToggle,
}: {
  item: DeclutterItem;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const missing =
    item.status === 'draft'
      ? missingForPublish({ title: item.title, categoryId: item.category_id, lgaId: item.lga_id, photoCount: item.listing_images.length })
      : [];
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      {selectable ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Select ${item.title}`}
          hitSlop={8}
          onPress={onToggle}>
          <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={26} color={selected ? colors.primary : colors.textMuted} />
        </Pressable>
      ) : null}
      <ListingPhoto path={item.listing_images[0]?.storage_path} style={styles.thumb} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.title}`}
        style={{ flex: 1, gap: 2 }}
        onPress={() => router.push({ pathname: '/listing-editor', params: { id: item.id } })}>
        <AppText style={{ fontWeight: '700' }} numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="small">{formatNaira(item.price_kobo)}</AppText>
        <AppText variant="caption" style={{ color: item.status === 'sold' ? colors.success : colors.textMuted }}>
          {STATUS_LABELS[item.status]}
          {item.status !== 'draft' && item.moderation_status === 'pending' ? ' · waiting for review' : ''}
        </AppText>
        {missing.length ? (
          <AppText variant="caption" style={{ color: colors.warning }}>
            Needs {missing.join(', ')}
          </AppText>
        ) : null}
      </Pressable>
    </Card>
  );
}

export default function DeclutterSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useDeclutterSession(id);
  const publish = usePublishDrafts();
  const complete = useCompleteSession();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  if (data.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }
  if (data.isError || !data.data) {
    return (
      <Screen>
        <Notice tone="danger" title="Could not load this session." />
        <Button label="Try again" onPress={() => void data.refetch()} />
      </Screen>
    );
  }

  const { session, items } = data.data;
  const { ready, incomplete } = splitPublishable(items);
  const readyIds = ready.map((i) => i.id);
  const chosen = selected.filter((x) => readyIds.includes(x));
  const counts = {
    draft: items.filter((i) => i.status === 'draft').length,
    available: items.filter((i) => i.status === 'active').length,
    reserved: items.filter((i) => i.status === 'reserved').length,
    sold: items.filter((i) => i.status === 'sold').length,
  };

  async function publishIds(ids: string[]) {
    setMessage(null);
    try {
      await publish.mutateAsync(ids);
      setSelected([]);
      setMessage({ tone: 'info', text: `Published ${ids.length} item${ids.length === 1 ? '' : 's'}. Well done!` });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Could not publish. Please try again.' });
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: session.title }} />
      <Screen>
        <View style={styles.counts}>
          {[
            ['Drafts', counts.draft],
            ['Available', counts.available],
            ['Reserved', counts.reserved],
            ['Sold', counts.sold],
          ].map(([label, n]) => (
            <View key={label} style={styles.count}>
              <AppText variant="title">{n}</AppText>
              <AppText variant="caption">{label}</AppText>
            </View>
          ))}
        </View>

        {session.status === 'in_progress' ? (
          <Button
            label="Add an item"
            kind="accent"
            onPress={() => router.push({ pathname: '/listing-editor', params: { session: session.id } })}
          />
        ) : (
          <Notice title="This session is finished. Great job decluttering!" />
        )}

        {message ? <Notice tone={message.tone} title={message.text} /> : null}

        {items.length === 0 ? (
          <Card>
            <AppText muted>No items yet. Tap “Add an item” and photograph the first thing you no longer need.</AppText>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                selectable={readyIds.includes(item.id)}
                selected={chosen.includes(item.id)}
                onToggle={() =>
                  setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]))
                }
              />
            ))}
          </View>
        )}

        {incomplete.length > 0 ? (
          <AppText variant="caption">
            {incomplete.length} draft{incomplete.length === 1 ? ' needs' : 's need'} more details before publishing. Tap it to finish.
          </AppText>
        ) : null}

        {ready.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Button
              label={chosen.length ? `Publish ${chosen.length} selected` : 'Select items above to publish them'}
              onPress={() => void publishIds(chosen)}
              disabled={chosen.length === 0}
              loading={publish.isPending}
            />
            <Button
              label={`Publish all ${ready.length} ready item${ready.length === 1 ? '' : 's'}`}
              kind="outline"
              onPress={() => void publishIds(readyIds)}
              disabled={publish.isPending}
            />
          </View>
        ) : null}

        {session.status === 'in_progress' && items.length > 0 && counts.draft === 0 ? (
          <Button label="Finish this session" kind="outline" onPress={() => complete.mutate(session.id)} loading={complete.isPending} />
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  counts: { flexDirection: 'row', gap: spacing.sm },
  count: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
});
