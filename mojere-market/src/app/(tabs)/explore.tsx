import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Chip,
  countActiveFilters,
  EMPTY_FILTERS,
  FilterSheet,
  SORT_OPTIONS,
  type FilterValues,
} from "@/components/filter-sheet";
import { ListingGrid } from "@/components/listing-grid";
import { SetupNotice } from "@/components/setup-notice";
import { AppText, Button, Card } from "@/components/ui";
import { INITIAL_CATEGORIES } from "@/constants/catalog";
import { useListingSearch } from "@/lib/listings";
import { colors, fontSize, MIN_TOUCH, radius, spacing } from "@/theme";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    q?: string;
    lga?: string;
  }>();
  const [text, setText] = useState(params.q ?? "");
  const [category, setCategory] = useState<string | null>(
    params.category ?? null,
  );
  const [filters, setFilters] = useState<FilterValues>({
    ...EMPTY_FILTERS,
    lgaId: params.lga ?? null,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const query = useDebounced(text, 400);

  // Follow links from the Home screen (category tiles, "see all").
  const [seen, setSeen] = useState({
    category: params.category,
    lga: params.lga,
  });
  if (params.category !== seen.category || params.lga !== seen.lga) {
    setSeen({ category: params.category, lga: params.lga });
    if (params.category !== seen.category) setCategory(params.category || null);
    if (params.lga !== seen.lga)
      setFilters((f) => ({ ...f, lgaId: params.lga || null }));
  }

  const search = useListingSearch({
    query,
    categorySlug: category,
    lgaId: filters.lgaId,
    minKobo: filters.minKobo,
    maxKobo: filters.maxKobo,
    conditions: filters.conditions,
    sort: filters.sort,
  });
  const items = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const activeCount = countActiveFilters(filters);
  const anyFilter = !!query.trim() || !!category || activeCount > 0;

  function clearAll() {
    setText("");
    setCategory(null);
    setFilters(EMPTY_FILTERS);
    router.setParams({ category: undefined, q: undefined, lga: undefined });
  }

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.xs }}>
      <SetupNotice />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search phones, chairs, books…"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            accessibilityLabel="Search listings"
            maxFontSizeMultiplier={1.6}
            style={styles.searchInput}
          />
          {text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={12}
              onPress={() => setText("")}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filters${activeCount ? `, ${activeCount} active` : ""}`}
          onPress={() => setSheetOpen(true)}
          style={[
            styles.filterButton,
            activeCount > 0 && { borderColor: colors.primary },
          ]}
        >
          <Ionicons name="options-outline" size={22} color={colors.primary} />
          {activeCount > 0 ? (
            <View style={styles.countBadge}>
              <AppText
                variant="caption"
                style={{ color: colors.textOnPrimary, fontWeight: "700" }}
              >
                {activeCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        <Chip
          label="All"
          selected={!category}
          onPress={() => setCategory(null)}
        />
        {INITIAL_CATEGORIES.map((c) => (
          <Chip
            key={c.slug}
            label={c.name}
            selected={category === c.slug}
            onPress={() => setCategory(c.slug)}
          />
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AppText variant="small" muted>
          {SORT_OPTIONS.find((s) => s.value === filters.sort)?.label}
          {filters.lgaId ? " · filtered by location" : " · all of Ondo State"}
        </AppText>
        {anyFilter ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={clearAll}>
            <AppText
              variant="small"
              style={{ color: colors.primary, fontWeight: "700" }}
            >
              Clear
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const empty = search.isLoading ? (
    <ActivityIndicator
      color={colors.primary}
      size="large"
      style={{ marginTop: spacing.xl }}
    />
  ) : search.isError ? (
    <Card style={{ alignItems: "center", paddingVertical: 32 }}>
      <Ionicons
        name="cloud-offline-outline"
        size={40}
        color={colors.textMuted}
      />
      <AppText variant="title">Could not load listings</AppText>
      <AppText muted style={{ textAlign: "center" }}>
        Check your internet connection and try again.
      </AppText>
      <Button label="Try again" onPress={() => void search.refetch()} />
    </Card>
  ) : (
    <Card style={{ alignItems: "center", paddingVertical: 32 }}>
      <Ionicons name="search-outline" size={40} color={colors.textMuted} />
      <AppText variant="title">
        {anyFilter ? "No matching items" : "No listings yet"}
      </AppText>
      <AppText muted style={{ textAlign: "center" }}>
        {anyFilter
          ? "Try a different word, fewer filters, or search all of Ondo State."
          : "Be the first to sell something in your area."}
      </AppText>
      {anyFilter ? (
        <Button
          label="Clear search and filters"
          kind="outline"
          onPress={clearAll}
        />
      ) : (
        <Button
          label="Sell an item"
          kind="accent"
          onPress={() => router.navigate("/sell")}
        />
      )}
    </Card>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <ListingGrid
        items={items}
        header={header}
        empty={empty}
        onEndReached={() => {
          if (search.hasNextPage && !search.isFetchingNextPage)
            void search.fetchNextPage();
        }}
        loadingMore={search.isFetchingNextPage}
        refreshing={search.isRefetching && !search.isFetchingNextPage}
        onRefresh={() => void search.refetch()}
      />
      {sheetOpen ? (
        <FilterSheet
          visible
          value={filters}
          onClose={() => setSheetOpen(false)}
          onApply={(v) => {
            setFilters(v);
            setSheetOpen(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
