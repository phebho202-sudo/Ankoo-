import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { ListingGrid } from '@/components/listing-grid';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { useBusinessOfUser } from '@/lib/business';
import { useListingSearch } from '@/lib/listings';
import { useRatingSummary } from '@/lib/offers';
import { supabase } from '@/lib/supabase';
import { monthYear } from '@/lib/time';
import { colors, spacing } from '@/theme';

type PublicProfile = {
  id: string;
  display_name: string;
  bio: string | null;
  neighbourhood: string | null;
  created_at: string;
  town: { name: string } | null;
  lga: { name: string } | null;
};

function useSellerProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['seller', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const [profile, verification] = await Promise.all([
        supabase!
          .from('user_profiles')
          .select(
            'id, display_name, bio, neighbourhood, created_at, town:locations!user_profiles_town_id_fkey(name), lga:locations!user_profiles_lga_id_fkey(name)',
          )
          .eq('id', id!)
          .maybeSingle(),
        supabase!.rpc('mm_verification_status', { user_ids: [id] }),
      ]);
      if (profile.error) throw profile.error;
      const v = (verification.data as { email_verified: boolean }[] | null)?.[0];
      return { profile: profile.data as PublicProfile | null, emailVerified: !!v?.email_verified };
    },
  });
}

export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seller = useSellerProfile(id);
  const listings = useListingSearch({ sellerId: id });
  const ratings = useRatingSummary(id);
  const storefront = useBusinessOfUser(id);
  const items = listings.data?.pages.flat() ?? [];
  const p = seller.data?.profile;

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
      {seller.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {seller.isError ? <Notice tone="danger" title="Could not load this seller. Check your connection." /> : null}
      {p ? (
        <Card>
          <AppText variant="heading">{p.display_name}</AppText>
          <AppText muted>{[p.neighbourhood, p.town?.name, p.lga?.name].filter(Boolean).join(', ') || 'Ondo State'}</AppText>
          <AppText variant="caption">Member since {monthYear(p.created_at)}</AppText>
          {seller.data?.emailVerified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText variant="small" style={{ color: colors.success }}>
                Email verified
              </AppText>
            </View>
          ) : null}
          {p.bio ? <AppText>{p.bio}</AppText> : null}
          {storefront.data ? (
            <Button
              label={`Visit ${storefront.data.name}`}
              kind="outline"
              onPress={() => router.push({ pathname: '/business/[slug]', params: { slug: storefront.data!.slug } })}
            />
          ) : null}
          {ratings.data && ratings.data.count > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={18} color={colors.accent} />
                <AppText style={{ fontWeight: '700' }}>{ratings.data.average!.toFixed(1)}</AppText>
                <AppText variant="small" muted>
                  from {ratings.data.count} confirmed sale{ratings.data.count === 1 ? '' : 's'}
                </AppText>
              </View>
              {ratings.data.recent
                .filter((r) => r.comment)
                .slice(0, 3)
                .map((r) => (
                  <AppText key={r.created_at} variant="small">
                    {'★'.repeat(r.rating)} “{r.comment}”
                  </AppText>
                ))}
            </View>
          ) : (
            <AppText variant="caption">No reviews yet. Reviews appear only after a sale both sides confirmed.</AppText>
          )}
        </Card>
      ) : null}
      <AppText variant="title">Items from this seller</AppText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ListingGrid
        items={items}
        header={header}
        empty={
          listings.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : listings.isError ? (
            <Button label="Try again" onPress={() => void listings.refetch()} />
          ) : (
            <AppText muted>No items listed yet.</AppText>
          )
        }
        onEndReached={() => {
          if (listings.hasNextPage && !listings.isFetchingNextPage) void listings.fetchNextPage();
        }}
        loadingMore={listings.isFetchingNextPage}
        refreshing={listings.isRefetching}
        onRefresh={() => void listings.refetch()}
      />
    </View>
  );
}
