import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { TextField } from '@/components/form';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createDeclutterSession, useDeclutterSessions } from '@/lib/declutter';
import { useInvalidateListings } from '@/lib/selling';
import { timeAgo } from '@/lib/time';
import { colors, spacing } from '@/theme';

export default function DeclutterHomeScreen() {
  const { session } = useAuth();
  const sessions = useDeclutterSessions();
  const invalidate = useInvalidateListings();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!session) {
      router.push('/auth/sign-in');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const id = await createDeclutterSession(session.user.id, name);
      await invalidate();
      setName('');
      router.push({ pathname: '/declutter/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="heading">Declutter My Home</AppText>
        <AppText muted>Let’s turn unused items into useful money.</AppText>
      </View>

      <Card>
        <AppText variant="title">How it works</AppText>
        {[
          'Start a session, for example “Bedroom” or “Moving out”.',
          'Walk around and add each unwanted item: a photo, a name and a price.',
          'Everything is saved as a draft, so you can stop and continue later.',
          'Review your items together and publish the ones you are ready to sell.',
          'Track what is available, reserved and sold.',
        ].map((t, i) => (
          <View key={t} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText style={{ fontWeight: '700', color: colors.accent }}>{i + 1}.</AppText>
            <AppText variant="small" style={{ flex: 1 }}>
              {t}
            </AppText>
          </View>
        ))}
      </Card>

      <Card>
        <TextField
          label="Name this session (optional)"
          placeholder="e.g. Bedroom clear-out"
          maxLength={80}
          value={name}
          onChangeText={setName}
        />
        {error ? <Notice tone="danger" title={error} /> : null}
        <Button label="Start decluttering" kind="accent" onPress={start} loading={creating} />
      </Card>

      {sessions.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {sessions.data && sessions.data.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">Your sessions</AppText>
          {sessions.data.map((s) => {
            const statuses = s.declutter_session_items.map((i) => i.listing?.status);
            const sold = statuses.filter((x) => x === 'sold').length;
            const drafts = statuses.filter((x) => x === 'draft').length;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${s.title}`}
                onPress={() => router.push({ pathname: '/declutter/[id]', params: { id: s.id } })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name="home-outline" size={26} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '700' }}>{s.title}</AppText>
                    <AppText variant="caption">
                      {statuses.length} item{statuses.length === 1 ? '' : 's'} · {drafts} draft{drafts === 1 ? '' : 's'} · {sold} sold
                      · started {timeAgo(s.created_at)}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
