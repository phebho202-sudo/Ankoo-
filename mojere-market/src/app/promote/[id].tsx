import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { paidFeaturesOnThisDevice, payWithPaystack, paymentsEnabled, useMyPromotions, usePackages, useRequestPromotion } from '@/lib/business';
import { formatNaira } from '@/lib/format';
import { useMyListing } from '@/lib/selling';
import { colors, radius, spacing } from '@/theme';

const STATUS: Record<string, string> = {
  pending_payment: 'Waiting for payment',
  active: 'Live',
  expired: 'Finished',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export default function PromoteScreen() {
  if (!paidFeaturesOnThisDevice()) {
    return (
      <Screen>
        <Notice title="Promotions are not available in this version of the app." />
      </Screen>
    );
  }
  return <PromoteContent />;
}

function PromoteContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useMyListing(id);
  const packages = usePackages();
  const mine = useMyPromotions();
  const request = useRequestPromotion();
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'warning' | 'danger'; text: string } | null>(null);

  const forThis = (mine.data ?? []).filter((p) => p.listing?.id === id);
  const live = forThis.find((p) => p.status === 'active');
  const options = (packages.data ?? []).filter((p) => p.kind !== 'assisted_listing');

  async function go() {
    if (!chosen || !id) return;
    setBusy(true);
    setMessage(null);
    try {
      const promotionId = await request.mutateAsync({ listingId: id, packageCode: chosen });
      const outcome = await payWithPaystack('promotion', promotionId);
      setMessage(
        outcome === 'paid'
          ? { tone: 'info', text: 'Payment confirmed. Your item is now promoted!' }
          : outcome === 'not_configured'
            ? { tone: 'warning', text: 'Request saved. Online payment is not switched on yet, so an admin will contact you to complete it.' }
            : outcome === 'failed'
              ? { tone: 'danger', text: 'The payment did not go through. You have not been charged by Mojere Market.' }
              : { tone: 'warning', text: 'Waiting for Paystack to confirm the payment. Check back in a few minutes.' },
      );
      void mine.refetch();
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Could not request the promotion.' });
    } finally {
      setBusy(false);
    }
  }

  if (listing.isLoading || packages.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!listing.data) {
    return (
      <Screen>
        <Notice tone="danger" title="This listing could not be found." />
      </Screen>
    );
  }
  const canPromote = listing.data.status === 'active' && listing.data.moderation_status === 'approved';

  return (
    <Screen>
      <AppText variant="heading">Promote your item</AppText>
      <AppText muted numberOfLines={2}>
        {listing.data.title}
      </AppText>

      {live ? (
        <Notice title={`Promoted until ${live.ends_at ? new Date(live.ends_at).toLocaleDateString('en-NG') : '—'}`}>
          <AppText variant="small">Your item shows as Featured.</AppText>
        </Notice>
      ) : null}
      {!canPromote ? <Notice tone="warning" title="Only live, approved listings can be promoted." /> : null}
      {!paymentsEnabled ? (
        <Notice tone="warning" title="Online payments are not switched on yet">
          <AppText variant="small">You can still request a promotion. It starts once payment is confirmed.</AppText>
        </Notice>
      ) : null}

      {options.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: chosen === p.code }}
          onPress={() => setChosen(p.code)}
          disabled={!canPromote}>
          <Card style={chosen === p.code ? { borderColor: colors.accent, backgroundColor: colors.accentSoft } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name={chosen === p.code ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.accent} />
              <AppText style={{ fontWeight: '700', flex: 1 }}>{p.name}</AppText>
              <AppText style={{ fontWeight: '700' }}>{formatNaira(p.price_kobo)}</AppText>
            </View>
            <AppText variant="small" muted>
              {p.kind === 'homepage'
                ? `Shown in Featured on the Home screen for ${p.duration_days} days.`
                : `Marked “Featured” and shown first in Featured for ${p.duration_days} days.`}
            </AppText>
          </Card>
        </Pressable>
      ))}

      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      <Button
        label={paymentsEnabled ? 'Pay with Paystack' : 'Request promotion'}
        kind="accent"
        onPress={() => void go()}
        disabled={!chosen || !canPromote}
        loading={busy}
      />
      <AppText variant="caption">
        Payments are processed securely by Paystack. Mojere Market never sees or stores your card details. Promotions start only
        after Paystack confirms the payment.
      </AppText>

      {forThis.length ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">History for this item</AppText>
          {forThis.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface }}>
              <AppText variant="small">{p.package?.name}</AppText>
              <AppText variant="small" style={{ fontWeight: '700' }}>
                {STATUS[p.status] ?? p.status}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
