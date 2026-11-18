import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { PageTitle } from '@/components/page-title';
import { SiteLinks } from '@/components/site-links';
import { DELETE_CONFIRM_WORD, deleteMyAccount } from '@/lib/account';
import { contactSupport } from '@/lib/support';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';
import { showAlert } from '@/lib/dialog';

export default function DeleteAccountScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <Screen>
        <PageTitle title="Delete your account" />
        <AppText variant="heading">Delete your {BRAND.name} account</AppText>
        <Card>
          <AppText variant="title">Delete it yourself (fastest)</AppText>
          <AppText variant="small">
            1. Log in to {BRAND.name} with the account you want to delete.{'\n'}2. Go to Profile → Delete my account.{'\n'}3. Type
            DELETE and confirm. Your account is deleted straight away.
          </AppText>
          <Button label="Log in" onPress={() => router.push('/auth/sign-in')} />
        </Card>
        <Card>
          <AppText variant="title">Or ask us to delete it</AppText>
          <AppText variant="small">
            Email {BRAND.supportEmail} from the email address of your account, with the subject “Delete my account”. We will
            delete it within 30 days and confirm by email.
          </AppText>
          <Button
            label="Email a deletion request"
            kind="outline"
            onPress={() => void contactSupport('Delete my account')}
          />
        </Card>
        <Card>
          <AppText variant="title">What is deleted and what is kept</AppText>
          <AppText variant="small">
            Deleted: your profile, login, photos, listings, messages, offers, reviews, saved items, notifications and business
            storefront. Kept: records of payments you made, for accounting and legal reasons, without your name or contact
            details.
          </AppText>
        </Card>
        <SiteLinks />
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
      showAlert('Account deleted', `Your ${BRAND.name} account has been deleted.`);
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
