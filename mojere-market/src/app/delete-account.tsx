import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { TextField } from '@/components/form';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { DELETE_CONFIRM_WORD, deleteMyAccount } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

export default function DeleteAccountScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <Screen>
        <Notice title="You are not logged in">
          <AppText variant="small">Log in to the account you want to delete.</AppText>
        </Notice>
      </Screen>
    );
  }
  const userId = session.user.id;
  const confirmed = word.trim() === DELETE_CONFIRM_WORD;

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(userId, word);
      queryClient.clear();
      Alert.alert('Account deleted', `Your ${BRAND.name} account has been deleted.`);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Notice tone="danger" title="This cannot be undone">
        <AppText variant="small">Deleting your account is permanent. We cannot bring it back.</AppText>
      </Notice>
      <Card>
        <AppText variant="title">What will be deleted</AppText>
        <View style={{ gap: spacing.xs }}>
          {[
            'Your profile, login and photos',
            'All your listings, including drafts',
            'Your messages, offers and reviews',
            'Your saved items, notifications and business storefront',
          ].map((t) => (
            <AppText key={t} variant="small">
              • {t}
            </AppText>
          ))}
        </View>
        <AppText variant="title">What we keep</AppText>
        <AppText variant="small">
          Records of payments you made are kept for accounting and legal reasons, without your name or contact details.
        </AppText>
      </Card>
      <Card>
        <TextField
          label={`Type ${DELETE_CONFIRM_WORD} to confirm`}
          value={word}
          onChangeText={setWord}
          autoCapitalize="characters"
          autoCorrect={false}
          error={error ?? undefined}
        />
        <Button label="Delete my account permanently" onPress={onDelete} loading={busy} disabled={!confirmed} />
        <Button label="Cancel" kind="outline" onPress={() => router.back()} disabled={busy} />
      </Card>
    </Screen>
  );
}
