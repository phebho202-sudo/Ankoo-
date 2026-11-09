import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AdminGate, ReasonSheet } from '@/components/admin-ui';
import { Chip } from '@/components/filter-sheet';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { humanise, useAdminAction, useAdminReports, useReportContext, useStaffRole, type AdminReport } from '@/lib/admin';
import { timeAgo } from '@/lib/time';
import { colors, spacing } from '@/theme';

type Pending =
  | { kind: 'resolve' | 'dismiss'; report: AdminReport }
  | { kind: 'remove-listing'; report: AdminReport; listingId: string }
  | { kind: 'suspend'; report: AdminReport; userId: string };

function ReportCard({ r, onAction }: { r: AdminReport; onAction: (p: Pending) => void }) {
  const [expanded, setExpanded] = useState(false);
  const context = useReportContext(expanded ? r.id : null);
  const role = useStaffRole();
  const c = context.data;
  const open = r.status === 'open' || r.status === 'reviewing';

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText style={{ fontWeight: '700' }}>
          {humanise(r.reason)} · {r.target_type}
        </AppText>
        <AppText variant="caption">{timeAgo(r.created_at)}</AppText>
      </View>
      {r.details ? <AppText variant="small">“{r.details}”</AppText> : null}
      {!open ? (
        <AppText variant="caption">
          {humanise(r.status)}
          {r.resolution_note ? `: ${r.resolution_note}` : ''}
        </AppText>
      ) : null}

      {!expanded ? (
        <Button label="Investigate" kind="outline" onPress={() => setExpanded(true)} style={{ minHeight: 40 }} />
      ) : context.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : c ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption">Reported by {c.reporter ?? 'unknown'}</AppText>
          {c.other_reports_on_target > 0 ? (
            <Notice tone="warning" title={`${c.other_reports_on_target} other report(s) about the same target`} />
          ) : null}
          {c.listing ? (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="small">
                Listing: <AppText style={{ fontWeight: '700' }}>{c.listing.title}</AppText> ({c.listing.status} / {c.listing.moderation_status})
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Open listing" kind="outline" onPress={() => router.push({ pathname: '/listing/[id]', params: { id: c.listing!.id } })} style={{ flex: 1, minHeight: 40 }} />
                {open && c.listing.status !== 'removed' ? (
                  <Button
                    label="Remove listing"
                    kind="outline"
                    onPress={() => onAction({ kind: 'remove-listing', report: r, listingId: c.listing!.id })}
                    style={{ flex: 1, minHeight: 40, borderColor: colors.danger }}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
          {c.message ? (
            <Notice title={`Message from ${c.message.sender_name ?? 'user'}`}>
              <AppText variant="small">“{c.message.body}”</AppText>
            </Notice>
          ) : null}
          {c.reported_user ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <AppText variant="small" style={{ flex: 1 }}>
                User: <AppText style={{ fontWeight: '700' }}>{c.reported_user.name}</AppText> ({c.reported_user.status})
              </AppText>
              {open && role.data?.isAdmin && c.reported_user.status === 'active' ? (
                <Button
                  label="Suspend"
                  kind="outline"
                  onPress={() => onAction({ kind: 'suspend', report: r, userId: c.reported_user!.id })}
                  style={{ minHeight: 40, borderColor: colors.danger }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <Notice tone="danger" title="Could not load details." />
      )}

      {open ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Resolve" onPress={() => onAction({ kind: 'resolve', report: r })} style={{ flex: 1, minHeight: 40 }} />
          <Button label="Dismiss" kind="outline" onPress={() => onAction({ kind: 'dismiss', report: r })} style={{ flex: 1, minHeight: 40 }} />
        </View>
      ) : null}
    </Card>
  );
}

function Reports() {
  const [showOpen, setShowOpen] = useState(true);
  const reports = useAdminReports(showOpen);
  const action = useAdminAction();
  const [pending, setPending] = useState<Pending | null>(null);

  const titles = {
    resolve: 'Resolve report',
    dismiss: 'Dismiss report (no action needed)',
    'remove-listing': 'Remove the reported listing',
    suspend: 'Suspend this account',
  } as const;

  async function run(p: Pending, reason: string) {
    if (p.kind === 'resolve' || p.kind === 'dismiss') {
      await action.mutateAsync({
        fn: 'mm_admin_resolve_report',
        args: { p_report_id: p.report.id, p_status: p.kind === 'resolve' ? 'resolved' : 'dismissed', p_note: reason },
      });
    } else if (p.kind === 'remove-listing') {
      await action.mutateAsync({ fn: 'mm_admin_moderate_listing', args: { p_listing_id: p.listingId, p_decision: 'remove', p_reason: reason } });
    } else if (p.kind === 'suspend') {
      await action.mutateAsync({ fn: 'mm_admin_set_account_status', args: { p_user_id: p.userId, p_status: 'suspended', p_reason: reason } });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={reports.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Open (oldest first)" selected={showOpen} onPress={() => setShowOpen(true)} />
            <Chip label="Closed" selected={!showOpen} onPress={() => setShowOpen(false)} />
          </View>
        }
        renderItem={({ item }) => <ReportCard r={item} onAction={setPending} />}
        ListEmptyComponent={
          reports.isLoading ? <ActivityIndicator color={colors.primary} /> : <AppText muted>{showOpen ? 'No open reports. 🎉' : 'No closed reports yet.'}</AppText>
        }
      />
      {pending ? (
        <ReasonSheet
          title={titles[pending.kind]}
          confirmLabel={titles[pending.kind].split(' (')[0] ?? 'Confirm'}
          danger={pending.kind === 'suspend' || pending.kind === 'remove-listing'}
          onClose={() => setPending(null)}
          onConfirm={(reason) => run(pending, reason)}
        />
      ) : null}
    </View>
  );
}

export default function AdminReportsScreen() {
  return (
    <AdminGate>
      <Reports />
    </AdminGate>
  );
}
