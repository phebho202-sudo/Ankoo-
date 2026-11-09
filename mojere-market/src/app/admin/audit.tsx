import { ActivityIndicator, FlatList, View } from 'react-native';

import { AdminGate } from '@/components/admin-ui';
import { AppText, Card, Notice } from '@/components/ui';
import { humanise, useAdminUsers, useAuditLog } from '@/lib/admin';
import { colors, spacing } from '@/theme';

function Audit() {
  const log = useAuditLog();
  const staff = useAdminUsers('');
  const nameOf = (id: string | null) => staff.data?.find((u) => u.id === id)?.display_name ?? (id ? 'staff' : 'system');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={log.data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        ListHeaderComponent={
          <AppText muted style={{ marginBottom: spacing.sm }}>
            The audit log cannot be edited or deleted, even by admins.
          </AppText>
        }
        renderItem={({ item: a }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText style={{ fontWeight: '700', flex: 1 }}>{humanise(a.action)}</AppText>
              <AppText variant="caption">{new Date(a.created_at).toLocaleString('en-NG')}</AppText>
            </View>
            <AppText variant="small" muted>
              by {nameOf(a.admin_id)} · {a.target_type}
            </AppText>
            {a.reason ? <AppText variant="small">“{a.reason}”</AppText> : null}
          </Card>
        )}
        ListEmptyComponent={log.isLoading ? <ActivityIndicator color={colors.primary} /> : log.isError ? <Notice tone="danger" title="Could not load the audit log." /> : <AppText muted>No staff actions yet.</AppText>}
      />
    </View>
  );
}

export default function AdminAuditScreen() {
  return (
    <AdminGate>
      <Audit />
    </AdminGate>
  );
}
