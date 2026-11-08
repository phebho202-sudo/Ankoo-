import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Notice } from '@/components/ui';
import {
  conversationForNotification,
  useMarkNotificationsRead,
  useNotifications,
  type AppNotification,
} from '@/lib/notifications';
import { timeAgo } from '@/lib/time';
import { colors, radius, spacing } from '@/theme';

const ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  message: 'chatbubble-outline',
  offer_new: 'pricetag-outline',
  offer_countered: 'swap-horizontal-outline',
  offer_accepted: 'checkmark-circle-outline',
  offer_rejected: 'close-circle-outline',
  listing_status: 'document-text-outline',
  favorite_sold: 'heart-dislike-outline',
  account: 'person-circle-outline',
  promotion: 'megaphone-outline',
};

export default function NotificationsScreen() {
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = (list.data ?? []).filter((n) => !n.read_at).length;

  async function open(n: AppNotification) {
    if (!n.read_at) markRead.mutate([n.id]);
    const conversationId = await conversationForNotification(n).catch(() => null);
    if (conversationId) router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
    else if (n.data.listing_id) router.push({ pathname: '/listing/[id]', params: { id: n.data.listing_id } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        ListHeaderComponent={
          unread > 0 ? (
            <Button label={`Mark all ${unread} as read`} kind="outline" onPress={() => markRead.mutate('all')} loading={markRead.isPending} />
          ) : undefined
        }
        renderItem={({ item: n }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${n.title}${n.read_at ? '' : ', unread'}`}
            onPress={() => void open(n)}
            style={[styles.row, !n.read_at && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
            <Ionicons name={ICONS[n.type] ?? 'notifications-outline'} size={24} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText style={{ fontWeight: n.read_at ? '500' : '700' }}>{n.title}</AppText>
              {n.body ? (
                <AppText variant="small" muted numberOfLines={2}>
                  {n.body}
                </AppText>
              ) : null}
              <AppText variant="caption">{timeAgo(n.created_at)}</AppText>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : list.isError ? (
            <Notice tone="danger" title="Could not load notifications." />
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="notifications-outline" size={40} color={colors.textMuted} />
              <AppText variant="title">You are all caught up</AppText>
              <AppText muted style={{ textAlign: 'center' }}>
                New messages, offers and updates about your items will appear here.
              </AppText>
            </Card>
          )
        }
        ListFooterComponent={
          <Button label="Notification settings" kind="outline" onPress={() => router.push('/notification-settings')} />
        }
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
