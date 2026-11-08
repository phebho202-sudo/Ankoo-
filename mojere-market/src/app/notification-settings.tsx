import { useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { AppText, Card, Notice, Screen } from '@/components/ui';
import {
  DEFAULT_PREFS,
  useNotificationPrefs,
  useSaveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notifications';
import { colors, spacing } from '@/theme';

const OPTIONS: { key: keyof NotificationPrefs; label: string; help: string }[] = [
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
      <Notice title="Phone push notifications are not set up yet">
        <AppText variant="small">
          Alerts on your lock screen need the installable Mojere Market app, which is prepared in a later step. Until then,
          notifications appear inside the app.
        </AppText>
      </Notice>
    </Screen>
  );
}
