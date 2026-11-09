import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStaffRole } from '@/lib/admin';
import { colors, spacing } from '@/theme';

import { TextField } from './form';
import { AppText, Button, Notice, Screen } from './ui';

/**
 * Shows admin screens only to staff. This is a convenience: every admin
 * action is ALSO checked on the server, so hiding a button is not the
 * security — the database rules are.
 */
export function AdminGate({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const role = useStaffRole();
  if (role.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  const allowed = adminOnly ? role.data?.isAdmin : role.data?.isStaff;
  if (!allowed) {
    return (
      <Screen>
        <Notice tone="danger" title="This area is for Mojere Market staff only." />
      </Screen>
    );
  }
  return <>{children}</>;
}

/** Ask for a reason before a sensitive action. Reasons go into the audit log. */
export function ReasonSheet({
  title,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
  required = true,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  required?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (required && !reason.trim()) {
      setError('Please write a short reason. It is saved in the audit log.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <AppText variant="title" style={{ flex: 1 }}>
              {title}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <TextField label={required ? 'Reason (required)' : 'Note (optional)'} multiline maxLength={500} value={reason} onChangeText={setReason} autoFocus />
            {error ? <Notice tone="danger" title={error} /> : null}
            <Button label={confirmLabel} onPress={() => void confirm()} loading={busy} style={danger ? { backgroundColor: colors.danger } : undefined} />
            <Button label="Cancel" kind="outline" onPress={onClose} disabled={busy} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'warning' }) {
  return (
    <View
      style={{
        flexGrow: 1,
        width: '30%',
        backgroundColor: tone === 'warning' ? colors.warningSoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.md,
        gap: 2,
      }}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}
