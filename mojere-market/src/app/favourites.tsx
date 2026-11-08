import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { removeFavourite, useFavourites } from '@/lib/listings';
import { colors, spacing } from '@/theme';

export default function FavouritesScreen() {
  const favs = useFavourites();
  const qc = useQueryClient();

  async function remove(id: string) {
    await removeFavourite(id);
    await qc.invalidateQueries({ queryKey: ['favourites'] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={favs.data ?? []}
        keyExtractor={(f) => f.listing_id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '50%', gap: spacing.xs }}>
            {item.listing ? (
              <ListingCard item={item.listing} />
            ) : (
              <Card style={{ minHeight: 160, justifyContent: 'center' }}>
                <AppText variant="small" muted>
                  This item is no longer available.
                </AppText>
              </Card>
            )}
            <Button label="Remove" kind="outline" onPress={() => void remove(item.listing_id)} style={{ minHeight: 36 }} />
          </View>
        )}
        ListEmptyComponent={
          favs.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : favs.isError ? (
            <Notice tone="danger" title="Could not load your saved items." />
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <AppText variant="title">No saved items yet</AppText>
              <AppText muted style={{ textAlign: 'center' }}>
                Tap “Save item” on anything you like to find it here later.
              </AppText>
              <Button label="Browse items" kind="outline" onPress={() => router.navigate('/explore')} />
            </Card>
          )
        }
        refreshControl={<RefreshControl refreshing={favs.isRefetching} onRefresh={() => void favs.refetch()} tintColor={colors.primary} />}
      />
    </View>
  );
}
