import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { conditionLabel, ListingPhoto } from '@/components/listing-card';
import { ReportSheet } from '@/components/report-sheet';
import { SafetyTips } from '@/components/safety';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatNaira } from '@/lib/format';
import { recordListingView, useListing, useToggleFavourite } from '@/lib/listings';
import { startConversation } from '@/lib/messaging';
import { useMeetupSpots } from '@/lib/admin';
import { useLocations } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { monthYear, timeAgo } from '@/lib/time';
import { colors, radius, spacing } from '@/theme';

function useSellerVerification(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['verification', sellerId],
    enabled: !!supabase && !!sellerId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('mm_verification_status', { user_ids: [sellerId] });
      if (error) throw error;
      const row = (data as { email_verified: boolean; phone_verified: boolean }[] | null)?.[0];
      return row ?? { email_verified: false, phone_verified: false };
    },
  });
}

function Photos({ paths }: { paths: string[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const size = Math.min(width, 600);
  if (paths.length === 0) {
    return <ListingPhoto path={null} style={{ width: size, height: size * 0.75 }} />;
  }
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / size))}
        accessibilityLabel={`${paths.length} photo${paths.length === 1 ? '' : 's'}`}>
        {paths.map((p) => (
          <ListingPhoto key={p} path={p} style={{ width: size, height: size }} />
        ))}
      </ScrollView>
      {paths.length > 1 ? (
        <View style={styles.dots}>
          {paths.map((p, i) => (
            <View key={p} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <AppText variant="small" muted style={{ width: 92 }}>
        {label}
      </AppText>
      <AppText variant="small" style={{ flex: 1, fontWeight: '600' }}>
        {value}
      </AppText>
    </View>
  );
}

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const listing = useListing(id);
  const l = listing.data;
  const verification = useSellerVerification(l?.seller.id);
  const locations = useLocations();
  const lgaId = locations.data?.find((x) => x.kind === 'lga' && x.name === l?.lga_name)?.id;
  const spots = useMeetupSpots(lgaId, false);
  const favourite = useToggleFavourite(id ?? '');
  const [reportOpen, setReportOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [opening, setOpening] = useState<'chat' | 'offer' | null>(null);

  useEffect(() => {
    if (id) void recordListingView(id);
  }, [id]);

  if (listing.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }
  if (listing.isError) {
    return (
      <Screen>
        <Notice tone="danger" title="Could not load this item">
          <AppText variant="small">Check your internet connection and try again.</AppText>
        </Notice>
        <Button label="Try again" onPress={() => void listing.refetch()} />
      </Screen>
    );
  }
  if (!l) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
          <AppText variant="title">This item is no longer available</AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            It may have been sold, paused or removed by the seller.
          </AppText>
        </Card>
        <Button label="Browse other items" onPress={() => router.navigate('/explore')} />
      </Screen>
    );
  }

  const place = [l.neighbourhood, l.town_name, l.lga_name].filter(Boolean).join(', ');

  async function openChat(withOffer: boolean) {
    setActionError(null);
    if (!session) {
      router.push('/auth/sign-in');
      return;
    }
    setOpening(withOffer ? 'offer' : 'chat');
    try {
      const conversationId = await startConversation(l!.id);
      router.push({ pathname: '/chat/[id]', params: withOffer ? { id: conversationId, offer: '1' } : { id: conversationId } });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open the chat. Please try again.');
    } finally {
      setOpening(null);
    }
  }

  async function toggleFavourite() {
    setActionError(null);
    if (!session) {
      router.push('/auth/sign-in');
      return;
    }
    try {
      await favourite.mutateAsync(!l!.is_favourite);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update your saved items.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Photos paths={l.images.map((i) => i.path)} />

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {l.status === 'sold' ? <Notice tone="warning" title="This item has been sold." /> : null}
          {l.status === 'reserved' ? (
            <Notice tone="warning" title="Reserved: the seller has accepted an offer." />
          ) : null}
          {l.is_own && l.moderation_status === 'pending' ? (
            <Notice tone="warning" title="Waiting for review: only you can see this listing for now." />
          ) : null}
          {l.is_own && l.moderation_status === 'rejected' ? (
            <Notice tone="danger" title="This listing was not approved. Edit it to send it for review again." />
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <AppText variant="display" style={{ fontSize: 28 }}>
                {formatNaira(l.price_kobo)}
              </AppText>
              {l.is_negotiable ? (
                <View style={styles.pill}>
                  <AppText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                    Negotiable
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="heading">{l.title}</AppText>
            <AppText variant="small" muted>
              Posted {timeAgo(l.published_at ?? l.created_at)}
            </AppText>
          </View>

          {!l.is_own ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label={l.is_favourite ? 'Saved ♥' : 'Save item'}
                kind="outline"
                onPress={toggleFavourite}
                loading={favourite.isPending}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <Notice title="This is your listing">
              <AppText variant="small">
                Viewed {l.view_count ?? 0} time{l.view_count === 1 ? '' : 's'} by others.
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button
                  label="Edit"
                  kind="outline"
                  onPress={() => router.push({ pathname: '/listing-editor', params: { id: l.id } })}
                  style={{ flex: 1 }}
                />
                <Button label="My listings" kind="outline" onPress={() => router.push('/my-listings')} style={{ flex: 1 }} />
              </View>
            </Notice>
          )}
          {actionError ? <Notice tone="danger" title={actionError} /> : null}

          {!l.is_own && (l.status === 'active' || l.status === 'reserved') ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Message seller"
                onPress={() => void openChat(false)}
                loading={opening === 'chat'}
                disabled={!!opening}
                style={{ flex: 1 }}
              />
              {l.status === 'active' ? (
                <Button
                  label="Make an offer"
                  kind="accent"
                  onPress={() => void openChat(true)}
                  loading={opening === 'offer'}
                  disabled={!!opening}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          ) : null}

          <Card>
            <InfoRow icon="pricetag-outline" label="Condition" value={conditionLabel(l.condition)} />
            <InfoRow icon="grid-outline" label="Category" value={l.category.name} />
            <InfoRow icon="location-outline" label="Location" value={place} />
          </Card>

          {l.description ? (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="title">Description</AppText>
              <AppText>{l.description}</AppText>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Seller ${l.seller.display_name ?? ''}. View profile`}
            onPress={() => router.push({ pathname: '/seller/[id]', params: { id: l.seller.id } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={styles.avatar}>
                <AppText variant="title" style={{ color: colors.primary }}>
                  {(l.seller.display_name ?? '?').slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontWeight: '700' }}>{l.seller.display_name ?? 'Seller'}</AppText>
                {l.seller.area ? (
                  <AppText variant="caption">{l.seller.area}</AppText>
                ) : null}
                {l.seller.member_since ? (
                  <AppText variant="caption">Member since {monthYear(l.seller.member_since)}</AppText>
                ) : null}
                {verification.data?.email_verified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <AppText variant="caption" style={{ color: colors.success }}>
                      Email verified
                    </AppText>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </Pressable>

          {spots.data && spots.data.length ? (
            <Card>
              <AppText variant="title">Suggested safe meetup spots in {l.lga_name}</AppText>
              {spots.data.slice(0, 5).map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="small" style={{ fontWeight: '600' }}>
                      {m.name}
                    </AppText>
                    {m.description ? <AppText variant="caption">{m.description}</AppText> : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <SafetyTips />
          <Button label="Community guidelines" kind="outline" onPress={() => router.push('/guidelines')} />

          {!l.is_own ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report this listing"
              onPress={() => (session ? setReportOpen(true) : router.push('/auth/sign-in'))}
              style={styles.reportLink}>
              <Ionicons name="flag-outline" size={18} color={colors.danger} />
              <AppText variant="small" style={{ color: colors.danger, fontWeight: '600' }}>
                Report this listing
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <ReportSheet listingId={l.id} visible={reportOpen} onClose={() => setReportOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  pill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
  },
});
