import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { colors, spacing } from '@/theme';

const LINKS: { label: string; href: Href }[] = [
  { label: 'About', href: '/about' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Community guidelines', href: '/guidelines' },
  { label: 'Support', href: '/support' },
  { label: 'Delete account', href: '/delete-account' },
];

/** Footer links to the public information pages (also the website's footer). */
export function SiteLinks() {
  return (
    <View style={styles.wrap} accessibilityRole="none">
      <View style={styles.row}>
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} style={styles.link}>
            {l.label}
          </Link>
        ))}
      </View>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        © {new Date().getFullYear()} {BRAND.name} · {BRAND.region}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.md, rowGap: spacing.sm },
  link: { color: colors.primary, fontWeight: '600', paddingVertical: 4 },
});
