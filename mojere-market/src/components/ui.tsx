import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

/* ---------- Text ---------- */

type Variant = 'display' | 'heading' | 'title' | 'body' | 'small' | 'caption';

export function AppText({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[textStyles[variant], muted && { color: colors.textMuted }, style]}
    />
  );
}

const textStyles = StyleSheet.create({
  display: { fontSize: fontSize.display, fontWeight: '800', color: colors.text },
  heading: { fontSize: fontSize.heading, fontWeight: '700', color: colors.text },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.text },
  body: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
  small: { fontSize: fontSize.small, color: colors.text, lineHeight: 20 },
  caption: { fontSize: fontSize.caption, color: colors.textMuted },
});

/* ---------- Screen wrapper ---------- */

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.screenContent}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/* ---------- Button ---------- */

type ButtonKind = 'primary' | 'accent' | 'outline';

export function Button({
  label,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        buttonKinds[kind],
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={kind === 'outline' ? colors.primary : colors.textOnPrimary} />
      ) : (
        <Text style={[styles.buttonText, kind === 'outline' && { color: colors.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const buttonKinds = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  accent: { backgroundColor: colors.accent },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
});

/* ---------- Card & notices ---------- */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger';
  title: string;
  children?: ReactNode;
}) {
  const palette = {
    info: { bg: colors.primarySoft, border: colors.primary },
    warning: { bg: colors.warningSoft, border: colors.warning },
    danger: { bg: colors.dangerSoft, border: colors.danger },
  }[tone];
  return (
    <View
      accessibilityRole="summary"
      style={[styles.notice, { backgroundColor: palette.bg, borderLeftColor: palette.border }]}>
      <AppText variant="small" style={{ fontWeight: '700' }}>
        {title}
      </AppText>
      {children ? <View style={{ marginTop: spacing.xs }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: colors.textOnPrimary, fontSize: fontSize.body, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  notice: {
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});
