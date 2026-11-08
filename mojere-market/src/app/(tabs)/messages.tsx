import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingPhoto } from '@/components/listing-card';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useConversations, type ConversationSummary } from '@/lib/messaging';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import { colors, radius, spacing } from '@/theme';

function Row({ c }: { c: ConversationSummary }) {
  const preview = c.last_body ? `${c.last_from_me ? 'You: ' : ''}${c.last_body}` : 'No messages yet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.other_name ?? 'User'}, about ${c.listing_title ?? 'an item'}${c.unread ? ', unread' : ''}`}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <ListingPhoto path={c.listing_cover_path} style={styles.thumb} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <AppText style={{ fontWeight: c.unread ? '800' : '600', flex: 1 }} numberOfLines={1}>
            {c.other_name ?? 'User'}
            <AppText variant="caption">{c.i_am_seller ? '  · buyer' : '  · seller'}</AppText>
          </AppText>
          <AppText variant="caption">{timeAgo(c.last_message_at)}</AppText>
        </View>
        <AppText variant="caption" numberOfLines={1}>
          {c.listing_title ?? 'Item no longer available'}
        </AppText>
        <AppText variant="small" numberOfLines={1} style={{ fontWeight: c.unread ? '700' : '400', color: c.unread ? colors.text : colors.textMuted }}>
          {c.blocked_by_me ? 'Blocked' : preview}
        </AppText>
      </View>
      {c.unread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { session } = useAuth();
  const inbox = useConversations();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <FlatList
        data={inbox.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <AppText variant="heading">Messages</AppText>
            <SetupNotice />
          </View>
        }
        renderItem={({ item }) => <Row c={item} />}
        ListEmptyComponent={
          supabase && !session ? (
            <Card>
              <AppText variant="title">Log in to see your messages</AppText>
              <Button label="Log in" onPress={() => router.push('/auth/sign-in')} />
            </Card>
          ) : inbox.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : inbox.isError ? (
            <Notice tone="danger" title="Could not load your messages. Pull down to try again." />
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
              <AppText variant="title">No conversations yet</AppText>
              <AppText muted style={{ textAlign: 'center' }}>
                Open an item and tap “Message seller” to start a chat. Only the two of you can read it.
              </AppText>
              <Button label="Browse items" kind="outline" onPress={() => router.navigate('/explore')} />
            </Card>
          )
        }
        refreshControl={
          session ? <RefreshControl refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} tintColor={colors.primary} /> : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
});
