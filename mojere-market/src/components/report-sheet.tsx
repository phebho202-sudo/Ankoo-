import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { REPORT_REASONS, reportListing, type ReportReason } from '@/lib/listings';
import { colors, radius, spacing } from '@/theme';

import { TextField } from './form';
import { AppText, Button, Notice } from './ui';

export function ReportSheet({
  listingId,
  visible,
  onClose,
}: {
  listingId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setReason(null);
    setDetails('');
    setDone(false);
    setError(null);
    onClose();
  }

  async function submit() {
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await reportListing(listingId, reason, details);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the report. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <AppText variant="title" style={{ flex: 1 }}>
              Report this listing
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            {done ? (
              <>
                <Notice title="Thank you. Your report was sent.">
                  <AppText variant="small">
                    The Mojere Market team will review it. If you are in danger, contact the police.
                  </AppText>
                </Notice>
                <Button label="Done" onPress={close} />
              </>
            ) : (
              <>
                <AppText muted>Reports are private. The seller will not see who reported them.</AppText>
                {REPORT_REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: reason === r.value }}
                    onPress={() => setReason(r.value)}
                    style={[styles.option, reason === r.value && styles.optionSelected]}>
                    <Ionicons
                      name={reason === r.value ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={reason === r.value ? colors.primary : colors.textMuted}
                    />
                    <AppText>{r.label}</AppText>
                  </Pressable>
                ))}
                <TextField
                  label="More details (optional)"
                  multiline
                  maxLength={1000}
                  value={details}
                  onChangeText={setDetails}
                />
                {error ? <Notice tone="danger" title={error} /> : null}
                <Button label="Send report" onPress={submit} loading={sending} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
