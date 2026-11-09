import { useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { AppText, Card, Notice, Screen } from '@/components/ui';
import {
  DEFAULT_PREFS,
  useNotificationPrefs,
  useSaveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notifications';
import { canUsePush } from '@/lib/push';
import { colors, spacing } from '@/theme';

const OPTIONS: { key: Exclude<keyof NotificationPrefs, 'push_enabled'>; label: string; help: string }[] = [
  { key: 'messages', label: 'Messages', help: 'When someone sends you a message.' },
  { key: 'offers', label: 'Offers', help: 'New offers, counteroffers and accepted offers.' },
  { key: 'listing_updates', label: 'Listing updates', help: 'Review results, and saved items that sell.' },
  { key: 'account', label: 'Account', help: 'Important changes to your account.' },
  { key: 'promotions', label: 'Promotions', help: 'Updates about promotions you bought.' },
];

export default function NotificationSettingsScreen() {
  const prefs = useNotificationPrefs();
  const save = useSaveNotificationPrefs();
  const [error, setError] = useState<string | null>(null);
  const current = prefs.data ?? DEFAULT_PREFS;

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    setError(null);
    try {
      await save.mutateAsync({ ...current, [key]: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    }
  }

  if (prefs.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText muted>Choose which in-app notifications you receive.</AppText>
      <Card>
        {OPTIONS.map((o) => (
          <View key={o.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '600' }}>{o.label}</AppText>
              <AppText variant="caption">{o.help}</AppText>
            </View>
            <Switch
              accessibilityLabel={o.label}
              value={current[o.key]}
              onValueChange={(v) => void toggle(o.key, v)}
              disabled={save.isPending}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ))}
      </Card>
      {error ? <Notice tone="danger" title={error} /> : null}
      {canUsePush() ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '600' }}>Phone alerts</AppText>
              <AppText variant="caption">Show these notifications on your lock screen too.</AppText>
            </View>
            <Switch
              accessibilityLabel="Phone alerts"
              value={current.push_enabled}
              onValueChange={(v) => void toggle('push_enabled', v)}
              disabled={save.isPending}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>
      ) : (
        <Notice title="Phone alerts need the installed app">
          <AppText variant="small">
            Lock-screen alerts work in the installable Mojere Market app, not in the Expo Go test app. Notifications always appear inside
            the app.
          </AppText>
        </Notice>
      )}
    </Screen>
  );
}
