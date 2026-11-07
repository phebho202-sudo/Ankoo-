import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { BRAND } from '@/constants/brand';
import { colors, radius } from '@/theme';

import { AppText } from './ui';

/**
 * Temporary text-based logo: a green "reuse" badge (circular arrows around
 * a shopping bag idea) next to the wordmark. Replace with the final logo
 * artwork later by swapping this component only.
 */
export function Logo({ size = 'md', inverted = false }: { size?: 'md' | 'lg'; inverted?: boolean }) {
  const badge = size === 'lg' ? 56 : 36;
  const textColor = inverted ? colors.textOnPrimary : colors.primary;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND.name}>
      <View
        style={[
          styles.badge,
          {
            width: badge,
            height: badge,
            backgroundColor: inverted ? colors.textOnPrimary : colors.primary,
          },
        ]}>
        <Ionicons name="sync" size={badge * 0.62} color={inverted ? colors.primary : colors.textOnPrimary} />
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      </View>
      <View>
        <AppText
          variant={size === 'lg' ? 'display' : 'title'}
          style={{ color: textColor, letterSpacing: -0.5, lineHeight: size === 'lg' ? 34 : 24 }}>
          Mojere
          <AppText variant={size === 'lg' ? 'display' : 'title'} style={{ color: colors.accent }}>
            {' '}
            Market
          </AppText>
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, top: 4, right: 4 },
});
