import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { AdminGate, Stat } from '@/components/admin-ui';
import { AppText, Card, Notice } from '@/components/ui';
import { useAdminStats, useStaffRole } from '@/lib/admin';
import { formatNaira } from '@/lib/format';
import { colors, spacing } from '@/theme';

function Link({ icon, title, text, href, badge }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; text: string; href: Href; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(href)}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name={icon} size={26} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: '700' }}>{title}</AppText>
          <AppText variant="caption">{text}</AppText>
        </View>
        {badge ? (
          <View style={{ backgroundColor: colors.accent, borderRadius: 12, minWidth: 24, paddingHorizontal: 6, alignItems: 'center' }}>
            <AppText variant="caption" style={{ color: colors.textOnPrimary, fontWeight: '700' }}>
              {badge}
            </AppText>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

function Dashboard() {
  const stats = useAdminStats();
  const role = useStaffRole();
  const s = stats.data;
  const isAdmin = !!role.data?.isAdmin;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={() => void stats.refetch()} tintColor={colors.primary} />}>
      <AppText muted>{isAdmin ? 'You are signed in as an admin.' : 'You are signed in as a moderator.'} Every action you take is recorded in the audit log.</AppText>
      {stats.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {stats.isError ? <Notice tone="danger" title="Could not load the statistics." /> : null}
      {s ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Stat label="Users" value={s.users} />
          <Stat label="New users (7 days)" value={s.new_users_7d} />
          <Stat label="Live listings" value={s.active_listings} />
          <Stat label="New listings (7 days)" value={s.new_listings_7d} />
          <Stat label="Waiting for review" value={s.pending_review} tone={s.pending_review ? 'warning' : undefined} />
          <Stat label="Open reports" value={s.open_reports} tone={s.open_reports ? 'warning' : undefined} />
          <Stat label="Items sold" value={s.sold_listings} />
          <Stat label="Confirmed sales" value={s.confirmed_sales} />
          <Stat label="Conversations" value={s.conversations} />
          <Stat label="Businesses" value={s.businesses} />
          <Stat label="Live promotions" value={s.active_promotions} />
          <Stat label="Promotions awaiting payment" value={s.pending_promotions} tone={s.pending_promotions ? 'warning' : undefined} />
          <Stat label="Verified revenue (all time)" value={formatNaira(s.revenue_kobo)} />
          <Stat label="Verified revenue (30 days)" value={formatNaira(s.revenue_30d_kobo)} />
          <Stat label="Suspended accounts" value={s.suspended_users} />
        </View>
      ) : null}

      <Link icon="flag-outline" title="Reports" text="Review reported listings, users and messages" href="/admin/reports" badge={s?.open_reports} />
      <Link icon="pricetags-outline" title="Listings" text="Approve, reject, remove or restore listings" href="/admin/listings" badge={s?.pending_review} />
      <Link icon="people-outline" title="Users" text="Find users, see their activity, suspend or reactivate" href="/admin/users" />
      {isAdmin ? (
        <>
          <Link icon="cash-outline" title="Promotions, plans and payments" text="Activate promotions, edit prices, view payments" href="/admin/money" badge={s?.pending_promotions} />
          <Link icon="settings-outline" title="Categories, places and settings" text="Manage categories, towns, safe meetup spots, review rules" href="/admin/catalog" />
        </>
      ) : null}
      <Link icon="document-text-outline" title="Audit log" text="Every sensitive staff action, with reasons" href="/admin/audit" />
    </ScrollView>
  );
}

export default function AdminHome() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}
