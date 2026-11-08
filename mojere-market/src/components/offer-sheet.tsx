import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatNaira, parseNairaToKobo } from '@/lib/format';
import { colors, spacing } from '@/theme';

import { TextField } from './form';
import { AppText, Button, Notice } from './ui';

/** Enter an amount (and an optional note) for an offer or counteroffer. */
export function OfferSheet({
  title,
  askingKobo,
  withMessage,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  askingKobo?: number | null;
  withMessage?: boolean;
  submitLabel: string;
  onSubmit: (amountKobo: number, message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kobo = parseNairaToKobo(amount);

  async function submit() {
    if (kobo == null || kobo < 100) {
      setError('Enter an amount in Naira, e.g. 20000.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(kobo, message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <AppText variant="title" style={{ flex: 1 }}>
              {title}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {askingKobo != null ? <AppText muted>Asking price: {formatNaira(askingKobo)}</AppText> : null}
            <TextField
              label="Your offer (₦)"
              keyboardType="number-pad"
              placeholder="e.g. 20000"
              value={amount}
              onChangeText={setAmount}
              hint={kobo != null ? formatNaira(kobo) : undefined}
              autoFocus
            />
            {withMessage ? (
              <TextField label="Message (optional)" multiline maxLength={500} value={message} onChangeText={setMessage} />
            ) : null}
            <Notice title="An accepted offer is an agreement, not a payment.">
              <AppText variant="small">
                Mojere Market does not take payment. Meet safely, check the item, and only hand over money or goods when
                you are both satisfied.
              </AppText>
            </Notice>
            {error ? <Notice tone="danger" title={error} /> : null}
            <Button label={submitLabel} kind="accent" onPress={() => void submit()} loading={busy} />
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
});
