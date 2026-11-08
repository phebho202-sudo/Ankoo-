import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

import { AppText } from './ui';

/* ---------- Text field ---------- */

export function TextField({
  label,
  error,
  hint,
  secure,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="small" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <View style={[styles.inputWrap, !!error && { borderColor: colors.danger }]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure ? hidden : undefined}
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={1.6}
          style={[styles.input, input.multiline && { minHeight: 96, textAlignVertical: 'top' }]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={12}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}

/* ---------- Checkbox ---------- */

export function Checkbox({
  checked,
  onChange,
  children,
  error,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        style={styles.checkRow}>
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={26}
          color={checked ? colors.primary : colors.textMuted}
        />
        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/* ---------- Select (pick one from a list) ---------- */

export type Option = { value: string; label: string };

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  error,
  allowClear,
}: {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (v: string | null) => void;
  placeholder?: string;
  error?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="small" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'not chosen'}`}
        onPress={() => setOpen(true)}
        style={[styles.inputWrap, styles.select, !!error && { borderColor: colors.danger }]}>
        <AppText style={{ flex: 1, color: selected ? colors.text : colors.textMuted }}>
          {selected?.label ?? placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalHeader}>
            <AppText variant="title" style={{ flex: 1 }}>
              {label}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => setOpen(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={allowClear ? [{ value: '', label: 'Not specified' }, ...options] : options}
            keyExtractor={(o) => o.value || 'none'}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === (value ?? '') }}
                onPress={() => {
                  onChange(item.value || null);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.primarySoft }]}>
                <AppText style={{ flex: 1 }}>{item.label}</AppText>
                {item.value === (value ?? '') ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
  },
  input: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eye: { paddingHorizontal: spacing.md },
  select: { paddingHorizontal: spacing.md },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', minHeight: MIN_TOUCH },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
