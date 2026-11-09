import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AdminGate, ReasonSheet } from '@/components/admin-ui';
import { Chip } from '@/components/filter-sheet';
import { TextField } from '@/components/form';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { useAdminAction, useAdminPayments, useAdminPromotions, useAdminTableEdit, type AdminPromotion } from '@/lib/admin';
import { usePackages, usePlans } from '@/lib/business';
import { formatNaira, parseNairaToKobo } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { colors, spacing } from '@/theme';

type Tab = 'promotions' | 'prices' | 'payments';

function PriceRow({ table, id, name, priceKobo }: { table: 'promotion_packages' | 'business_plans'; id: string; name: string; priceKobo: number }) {
  const edit = useAdminTableEdit();
  const [text, setText] = useState(String(priceKobo / 100));
  const [message, setMessage] = useState<string | null>(null);
  const kobo = parseNairaToKobo(text);
  const changed = kobo != null && kobo !== priceKobo;

  async function save() {
    if (kobo == null) {
      setMessage('Enter a valid amount.');
      return;
    }
    try {
      await edit.mutateAsync({ table, id, values: { price_kobo: kobo } });
      setMessage(`Saved: ${formatNaira(kobo)}. Recorded in the audit log.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <View style={{ gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
      <AppText style={{ fontWeight: '600' }}>{name}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField label="Price (₦)" keyboardType="number-pad" value={text} onChangeText={setText} hint={kobo != null ? formatNaira(kobo) : undefined} />
        </View>
        <Button label="Save" onPress={() => void save()} disabled={!changed} loading={edit.isPending} style={{ marginBottom: 22 }} />
      </View>
      {message ? <AppText variant="caption">{message}</AppText> : null}
    </View>
  );
}

function Money() {
  const [tab, setTab] = useState<Tab>('promotions');
  const promotions = useAdminPromotions();
  const payments = useAdminPayments();
  const plans = usePlans();
  const packages = usePackages();
  const action = useAdminAction();
  const [pending, setPending] = useState<{ promo: AdminPromotion; kind: 'activate' | 'cancelled' | 'refunded' } | null>(null);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip label="Promotions" selected={tab === 'promotions'} onPress={() => setTab('promotions')} />
        <Chip label="Prices" selected={tab === 'prices'} onPress={() => setTab('prices')} />
        <Chip label="Payments" selected={tab === 'payments'} onPress={() => setTab('payments')} />
      </View>

      {tab === 'promotions' ? (
        <>
          <Notice title="Only activate a promotion after you have confirmed the money yourself">
            <AppText variant="small">For example a bank transfer you can see in your account. Paystack payments activate automatically.</AppText>
          </Notice>
          {promotions.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {(promotions.data ?? []).map((p) => (
            <Card key={p.id}>
              <AppText style={{ fontWeight: '700' }}>{p.listing?.title ?? 'Listing removed'}</AppText>
              <AppText variant="small">
                {p.package?.name} · {formatNaira(p.price_kobo)} · by {p.purchaser?.display_name ?? 'unknown'}
              </AppText>
              <AppText variant="caption">
                {p.status}
                {p.ends_at && p.status === 'active' ? ` until ${new Date(p.ends_at).toLocaleDateString('en-NG')}` : ''} · requested {timeAgo(p.created_at)}
              </AppText>
              {p.status === 'pending_payment' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label="Activate (paid)" onPress={() => setPending({ promo: p, kind: 'activate' })} style={{ flex: 1, minHeight: 40 }} />
                  <Button label="Cancel" kind="outline" onPress={() => setPending({ promo: p, kind: 'cancelled' })} style={{ flex: 1, minHeight: 40 }} />
                </View>
              ) : p.status === 'active' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label="Stop" kind="outline" onPress={() => setPending({ promo: p, kind: 'cancelled' })} style={{ flex: 1, minHeight: 40 }} />
                  <Button label="Mark refunded" kind="outline" onPress={() => setPending({ promo: p, kind: 'refunded' })} style={{ flex: 1, minHeight: 40 }} />
                </View>
              ) : null}
            </Card>
          ))}
          {promotions.isSuccess && !promotions.data.length ? <AppText muted>No promotions yet.</AppText> : null}
        </>
      ) : null}

      {tab === 'prices' ? (
        <>
          <Notice tone="warning" title="Price changes apply to new purchases only">
            <AppText variant="small">Requests already made keep the price shown at the time. Every change is audited.</AppText>
          </Notice>
          <Card>
            <AppText variant="title">Promotion packages</AppText>
            {(packages.data ?? []).map((p) => (
              <PriceRow key={p.id} table="promotion_packages" id={p.id} name={p.name} priceKobo={p.price_kobo} />
            ))}
          </Card>
          <Card>
            <AppText variant="title">Business plans (per month)</AppText>
            {(plans.data ?? []).map((p) => (
              <PriceRow key={p.id} table="business_plans" id={p.id} name={p.name} priceKobo={p.price_kobo} />
            ))}
          </Card>
        </>
      ) : null}

      {tab === 'payments' ? (
        <>
          {payments.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {(payments.data ?? []).map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ fontWeight: '700' }}>{formatNaira(p.amount_kobo)}</AppText>
                <AppText variant="small" style={{ color: p.status === 'success' ? colors.success : p.status === 'failed' ? colors.danger : colors.textMuted }}>
                  {p.status}
                </AppText>
              </View>
              <AppText variant="caption">
                {p.purpose.replace('_', ' ')} · {p.reference} · {timeAgo(p.created_at)}
              </AppText>
            </Card>
          ))}
          {payments.isSuccess && !payments.data.length ? <AppText muted>No payments yet. Online payments are switched off.</AppText> : null}
        </>
      ) : null}

      {pending ? (
        <ReasonSheet
          title={pending.kind === 'activate' ? 'Activate this promotion' : pending.kind === 'refunded' ? 'Mark as refunded' : 'Stop / cancel this promotion'}
          confirmLabel={pending.kind === 'activate' ? 'Activate' : 'Confirm'}
          onClose={() => setPending(null)}
          onConfirm={(reason) =>
            pending.kind === 'activate'
              ? action.mutateAsync({ fn: 'mm_admin_activate_promotion', args: { p_promotion_id: pending.promo.id, p_reason: reason } })
              : action.mutateAsync({
                  fn: 'mm_admin_set_promotion_status',
                  args: { p_promotion_id: pending.promo.id, p_status: pending.kind, p_reason: reason },
                })
          }
        />
      ) : null}
    </Screen>
  );
}

export default function AdminMoneyScreen() {
  return (
    <AdminGate adminOnly>
      <Money />
    </AdminGate>
  );
}
