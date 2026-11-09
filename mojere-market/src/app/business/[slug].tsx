import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, View } from 'react-native';

import { ListingGrid } from '@/components/listing-grid';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { businessLogoUrl, toWhatsAppNumber, useBusinessBySlug } from '@/lib/business';
import { useListingSearch } from '@/lib/listings';
import { useRatingSummary } from '@/lib/offers';
import { useLocations } from '@/lib/profile';
import { colors, radius, spacing } from '@/theme';

export default function StorefrontScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const biz = useBusinessBySlug(slug);
  const b = biz.data;
  const listings = useListingSearch({ sellerId: b?.owner_id ?? '00000000-0000-0000-0000-000000000000' });
  const ratings = useRatingSummary(b?.owner_id);
  const locations = useLocations();
  const place = [locations.data?.find((l) => l.id === b?.town_id)?.name, locations.data?.find((l) => l.id === b?.lga_id)?.name]
    .filter(Boolean)
    .join(', ');
  const logo = businessLogoUrl(b?.logo_path);
  const items = b ? (listings.data?.pages.flat() ?? []) : [];

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
      {biz.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {biz.isSuccess && !b ? <Notice tone="warning" title="This business could not be found." /> : null}
      {b ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {logo ? (
              <Image source={{ uri: logo }} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="cover" />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="storefront-outline" size={28} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <AppText variant="title">{b.name}</AppText>
              {place ? <AppText variant="small" muted>{place}</AppText> : null}
              {ratings.data?.count ? (
                <AppText variant="small">
                  ★ {ratings.data.average!.toFixed(1)} · {ratings.data.count} confirmed sale{ratings.data.count === 1 ? '' : 's'}
                </AppText>
              ) : null}
            </View>
          </View>
          {b.description ? <AppText>{b.description}</AppText> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {b.contact_phone ? (
              <Button label="Call" kind="outline" onPress={() => void Linking.openURL(`tel:${b.contact_phone}`)} style={{ flexGrow: 1 }} />
            ) : null}
            {b.whatsapp ? (
              <Button
                label="WhatsApp"
                kind="outline"
                onPress={() => void Linking.openURL(`https://wa.me/${toWhatsAppNumber(b.whatsapp!)}`)}
                style={{ flexGrow: 1 }}
              />
            ) : null}
            {b.contact_email ? (
              <Button label="Email" kind="outline" onPress={() => void Linking.openURL(`mailto:${b.contact_email}`)} style={{ flexGrow: 1 }} />
            ) : null}
          </View>
          <AppText variant="caption">
            For your safety, keep chats in Mojere Market where possible and never pay in advance for items you have not seen.
          </AppText>
        </Card>
      ) : null}
      {b ? <AppText variant="title">Items</AppText> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: b?.name ?? 'Business' }} />
      <ListingGrid
        items={items}
        header={header}
        empty={b && listings.isSuccess ? <AppText muted>No items listed yet.</AppText> : undefined}
        onEndReached={() => {
          if (listings.hasNextPage && !listings.isFetchingNextPage) void listings.fetchNextPage();
        }}
        loadingMore={listings.isFetchingNextPage}
      />
    </View>
  );
}
