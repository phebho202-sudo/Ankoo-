import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AdminGate, ReasonSheet } from '@/components/admin-ui';
import { TextField } from '@/components/form';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { useAdminAction, useAdminUsers, useStaffRole, type AdminUser } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { monthYear } from '@/lib/time';
import { colors, spacing } from '@/theme';

function Users() {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);
  const users = useAdminUsers(search);
  const role = useStaffRole();
  const { session } = useAuth();
  const action = useAdminAction();
  const [pending, setPending] = useState<AdminUser | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={users.data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={<TextField label="Search by name or email" autoCapitalize="none" value={text} onChangeText={setText} />}
        renderItem={({ item: u }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText style={{ fontWeight: '700', flex: 1 }}>
                {u.display_name}
                {u.role ? <AppText variant="caption"> · {u.role}</AppText> : null}
              </AppText>
              <AppText variant="caption" style={{ color: u.account_status === 'suspended' ? colors.danger : colors.success }}>
                {u.account_status}
              </AppText>
            </View>
            <AppText variant="small" muted>
              {u.email ?? 'no email'} {u.email_verified ? '· verified' : '· not verified'}
            </AppText>
            <AppText variant="caption">
              Joined {monthYear(u.created_at)} · {u.active_listings} live listing{u.active_listings === 1 ? '' : 's'} · {u.open_reports} open report
              {u.open_reports === 1 ? '' : 's'}
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Public profile" kind="outline" onPress={() => router.push({ pathname: '/seller/[id]', params: { id: u.id } })} style={{ flex: 1, minHeight: 40 }} />
              {role.data?.isAdmin && u.id !== session?.user.id ? (
                <Button
                  label={u.account_status === 'active' ? 'Suspend' : 'Reactivate'}
                  kind="outline"
                  onPress={() => setPending(u)}
                  style={{ flex: 1, minHeight: 40, borderColor: u.account_status === 'active' ? colors.danger : colors.primary }}
                />
              ) : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={users.isLoading ? <ActivityIndicator color={colors.primary} /> : users.isError ? <Notice tone="danger" title="Could not load users." /> : <AppText muted>No users found.</AppText>}
      />
      {pending ? (
        <ReasonSheet
          title={pending.account_status === 'active' ? `Suspend ${pending.display_name}?` : `Reactivate ${pending.display_name}?`}
          confirmLabel={pending.account_status === 'active' ? 'Suspend account' : 'Reactivate account'}
          danger={pending.account_status === 'active'}
          onClose={() => setPending(null)}
          onConfirm={(reason) =>
            action.mutateAsync({
              fn: 'mm_admin_set_account_status',
              args: { p_user_id: pending.id, p_status: pending.account_status === 'active' ? 'suspended' : 'active', p_reason: reason },
            })
          }
        />
      ) : null}
    </View>
  );
}

export default function AdminUsersScreen() {
  return (
    <AdminGate>
      <Users />
    </AdminGate>
  );
}
