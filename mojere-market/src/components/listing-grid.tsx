import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import type { ListingSummary } from '@/lib/listings';
import { colors, spacing } from '@/theme';

import { ListingCard } from './listing-card';

/** Two-column, infinitely scrolling grid of listings. */
export function ListingGrid({
  items,
  header,
  empty,
  onEndReached,
  loadingMore,
  refreshing,
  onRefresh,
}: {
  items: ListingSummary[];
  header?: ReactElement;
  empty?: ReactElement;
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
          <ListingCard item={item} />
        </View>
      )}
      onEndReachedThreshold={0.5}
      onEndReached={onEndReached}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} /> : undefined}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}
