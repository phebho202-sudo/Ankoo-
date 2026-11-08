import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';

import { CONDITIONS } from '@/constants/catalog';
import { formatNaira } from '@/lib/format';
import { listingImageUrl, type ListingSummary } from '@/lib/listings';
import { timeAgo } from '@/lib/time';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './ui';

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

export function placeLabel(l: { neighbourhood?: string | null; town_name?: string | null; lga_name: string }) {
  return l.town_name ?? l.neighbourhood ?? l.lga_name;
}

/** Product photo, or a neutral placeholder when there is no photo. */
export function ListingPhoto({ path, style }: { path: string | null | undefined; style: ViewStyle }) {
  const uri = listingImageUrl(path);
  if (!uri) {
    return (
      <View style={[style, styles.placeholder]} accessibilityLabel="No photo">
        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style as ImageStyle}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  );
}

export function ListingCard({ item, width }: { item: ListingSummary; width?: number | `${number}%` }) {
  const label = `${item.title}, ${formatNaira(item.price_kobo)}, ${placeLabel(item)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.card, width !== undefined && { width }, pressed && { opacity: 0.85 }]}>
      <View>
        <ListingPhoto path={item.cover_path} style={styles.photo} />
        {item.is_featured ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <AppText variant="caption" style={styles.badgeText}>
              Featured
            </AppText>
          </View>
        ) : null}
        {item.status !== 'active' ? (
          <View style={[styles.badge, { backgroundColor: colors.text, left: undefined, right: spacing.sm }]}>
            <AppText variant="caption" style={styles.badgeText}>
              {item.status === 'reserved' ? 'Reserved' : 'Sold'}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="title" style={{ fontSize: 17 }} numberOfLines={1}>
          {formatNaira(item.price_kobo)}
        </AppText>
        <AppText variant="small" numberOfLines={2}>
          {item.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {placeLabel(item)} · {timeAgo(item.published_at)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.primarySoft },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.sm, gap: 2 },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: colors.textOnPrimary, fontWeight: '700' },
});
