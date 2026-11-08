import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useMyProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme';

function BigOption({
  icon,
  title,
  text,
  href,
  accent,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  text: string;
  href: Href;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.option, accent && styles.optionAccent, pressed && { opacity: 0.85 }]}>
      <View style={[styles.optionIcon, accent && { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={26} color={accent ? colors.textOnPrimary : colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title">{title}</AppText>
        <AppText variant="small" muted>
          {text}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

export default function SellScreen() {
  const { session } = useAuth();
  const profile = useMyProfile();

  return (
    <Screen>
      <AppText variant="heading">Sell on Mojere Market</AppText>
      <AppText muted>Your unused items could make someone else’s day. Standard listings are free.</AppText>
      <SetupNotice />

      {supabase && !session ? (
        <Card>
          <AppText variant="title">Log in to start selling</AppText>
          <AppText muted>Every listing belongs to a real, signed-in seller. It only takes a minute.</AppText>
          <Button label="Create an account" onPress={() => router.push('/auth/sign-up')} />
          <Button label="Log in" kind="outline" onPress={() => router.push('/auth/sign-in')} />
        </Card>
      ) : null}

      {session && profile.isSuccess && !profile.data?.lga_id ? (
        <Notice tone="warning" title="Add your location first">
          <AppText variant="small">Buyers need to know roughly where your items are.</AppText>
          <Button label="Add my location" kind="outline" onPress={() => router.push('/edit-profile')} />
        </Notice>
      ) : null}

      {session ? (
        <View style={{ gap: spacing.md }}>
          <BigOption
            icon="camera-outline"
            title="Sell an item"
            text="Add photos, a price and details. Publish in minutes."
            href="/listing-editor"
            accent
          />
          <BigOption
            icon="home-outline"
            title="Declutter My Home"
            text="Go room by room, add several items as drafts, then publish them together."
            href="/declutter"
          />
          <BigOption
            icon="list-outline"
            title="My listings"
            text="Edit, pause, mark as sold or delete your items, and see how many people viewed them."
            href="/my-listings"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  optionAccent: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
