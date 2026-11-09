import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, View } from 'react-native';

import { SelectField, TextField } from '@/components/form';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { BRAND } from '@/constants/brand';
import { useAuth } from '@/lib/auth';
import {
  businessLogoUrl,
  payWithPaystack,
  paymentsEnabled,
  slugify,
  useMyBusiness,
  usePlans,
  useRequestPlan,
  useSaveBusiness,
  type Business,
  type Subscription,
} from '@/lib/business';
import { formatNaira } from '@/lib/format';
import { pickFromLibrary } from '@/lib/photos';
import { useLocations } from '@/lib/profile';
import { useCategories } from '@/lib/selling';
import { businessSchema, type BusinessFormValues } from '@/lib/validation';
import { colors, radius, spacing } from '@/theme';

type Parsed = ReturnType<typeof businessSchema.parse>;

function BusinessForm({ business, onSaved }: { business: Business | null; onSaved: () => void }) {
  const save = useSaveBusiness();
  const categories = useCategories();
  const locations = useLocations();
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(!!business);

  const { control, handleSubmit, setValue, formState } = useForm<BusinessFormValues, unknown, Parsed>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: business?.name ?? '',
      slug: business?.slug ?? '',
      description: business?.description ?? '',
      categoryId: business?.category_id ?? null,
      contactPhone: business?.contact_phone ?? '',
      contactEmail: business?.contact_email ?? '',
      whatsapp: business?.whatsapp ?? '',
      lgaId: business?.lga_id ?? null,
      townId: business?.town_id ?? null,
    },
  });
  const lgaId = useWatch({ control, name: 'lgaId' });
  const lgas = useMemo(() => (locations.data ?? []).filter((l) => l.kind === 'lga').map((l) => ({ value: l.id, label: l.name })), [locations.data]);
  const towns = useMemo(
    () => (locations.data ?? []).filter((l) => l.kind === 'town' && l.parent_id === lgaId).map((l) => ({ value: l.id, label: l.name })),
    [locations.data, lgaId],
  );
  const categoryOptions = useMemo(() => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })), [categories.data]);
  const logoPreview = logoUri ?? businessLogoUrl(business?.logo_path) ?? undefined;

  async function chooseLogo() {
    const result = await pickFromLibrary(1);
    if (!result.ok) setError(result.message);
    else if (result.uris[0]) setLogoUri(result.uris[0]);
  }

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await save.mutateAsync({ input: v, existingId: business?.id, logoUri });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    }
  });

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {logoPreview ? (
          <Image source={{ uri: logoPreview }} style={{ width: 72, height: 72, borderRadius: radius.md }} contentFit="cover" />
        ) : (
          <View style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.primarySoft }} />
        )}
        <Button label={logoPreview ? 'Change logo' : 'Add logo'} kind="outline" onPress={() => void chooseLogo()} style={{ flex: 1 }} />
      </View>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Business name"
            value={field.value}
            onChangeText={(t) => {
              field.onChange(t);
              if (!slugTouched) setValue('slug', slugify(t));
            }}
            error={formState.errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="slug"
        render={({ field }) => (
          <TextField
            label="Web name"
            autoCapitalize="none"
            hint="Used in your storefront link. Lowercase letters, numbers and dashes."
            value={field.value}
            onChangeText={(t) => {
              setSlugTouched(true);
              field.onChange(t.toLowerCase());
            }}
            error={formState.errors.slug?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField label="What do you sell?" multiline maxLength={1000} value={field.value} onChangeText={field.onChange} error={formState.errors.description?.message} />
        )}
      />
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <SelectField label="Main category (optional)" value={field.value} options={categoryOptions} onChange={field.onChange} allowClear />
        )}
      />
      <Controller
        control={control}
        name="lgaId"
        render={({ field }) => (
          <SelectField
            label="Local government area"
            value={field.value}
            options={lgas}
            onChange={(v) => {
              field.onChange(v);
              setValue('townId', null);
            }}
            error={formState.errors.lgaId?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="townId"
        render={({ field }) => <SelectField label="Town (optional)" value={field.value} options={towns} onChange={field.onChange} allowClear />}
      />
      <AppText variant="small" muted>
        Contact details below are shown publicly on your storefront. Leave a box empty to keep it private.
      </AppText>
      <Controller
        control={control}
        name="contactPhone"
        render={({ field }) => (
          <TextField label="Business phone (optional)" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} error={formState.errors.contactPhone?.message} />
        )}
      />
      <Controller
        control={control}
        name="whatsapp"
        render={({ field }) => (
          <TextField label="WhatsApp (optional)" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} error={formState.errors.whatsapp?.message} />
        )}
      />
      <Controller
        control={control}
        name="contactEmail"
        render={({ field }) => (
          <TextField
            label="Business email (optional)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={field.value}
            onChangeText={field.onChange}
            error={formState.errors.contactEmail?.message}
          />
        )}
      />
      {error ? <Notice tone="danger" title={error} /> : null}
      <Button label={business ? 'Save changes' : 'Create my business'} onPress={submit} loading={save.isPending} />
    </View>
  );
}

function PlanSection({ subscriptions }: { subscriptions: Subscription[] }) {
  const plans = usePlans();
  const request = useRequestPlan();
  const [message, setMessage] = useState<{ tone: 'info' | 'warning' | 'danger'; text: string } | null>(null);
  const active = subscriptions.find((s) => s.status === 'active');
  const pending = subscriptions.find((s) => s.status === 'pending_payment');

  async function choose(code: string, price: number) {
    setMessage(null);
    try {
      const subscriptionId = await request.mutateAsync(code);
      if (price === 0) {
        setMessage({ tone: 'info', text: 'You are on the free plan.' });
        return;
      }
      const outcome = await payWithPaystack('business_subscription', subscriptionId);
      setMessage(
        outcome === 'paid'
          ? { tone: 'info', text: 'Payment confirmed. Your plan is active.' }
          : outcome === 'not_configured'
            ? { tone: 'warning', text: 'Online payment is not switched on yet. Your plan request is saved and an admin can activate it.' }
            : outcome === 'failed'
              ? { tone: 'danger', text: 'The payment did not go through. You have not been charged by Mojere Market.' }
              : { tone: 'warning', text: 'We are still waiting for Paystack to confirm. Check back in a few minutes.' },
      );
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Could not change the plan.' });
    }
  }

  return (
    <Card>
      <AppText variant="title">Your plan</AppText>
      <AppText>
        {active?.plan ? `${active.plan.name}${active.ends_at ? ` · renews by ${new Date(active.ends_at).toLocaleDateString('en-NG')}` : ''}` : 'Business Free'}
      </AppText>
      {pending?.plan ? <AppText variant="small" style={{ color: colors.warning }}>Waiting for payment: {pending.plan.name}</AppText> : null}
      {!paymentsEnabled ? (
        <Notice tone="warning" title="Online payments are not switched on yet">
          <AppText variant="small">You can request a paid plan now. It starts once payment is confirmed.</AppText>
        </Notice>
      ) : null}
      {(plans.data ?? []).map((p) => {
        const current = active?.plan?.code === p.code || (!active && p.code === 'free');
        return (
          <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText style={{ fontWeight: '700' }}>{p.name}</AppText>
              <AppText style={{ fontWeight: '700' }}>{p.price_kobo === 0 ? 'Free' : `${formatNaira(p.price_kobo)}/month`}</AppText>
            </View>
            <AppText variant="caption">{(p.features ?? []).join(' · ')}</AppText>
            {current ? (
              <AppText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
                Current plan
              </AppText>
            ) : (
              <Button
                label={p.price_kobo === 0 ? 'Switch to free' : paymentsEnabled ? `Pay ${formatNaira(p.price_kobo)}` : 'Request this plan'}
                kind="outline"
                onPress={() =>
                  Alert.alert(`Choose ${p.name}?`, p.price_kobo ? `${formatNaira(p.price_kobo)} per month.` : 'Paid features stop at once.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Continue', onPress: () => void choose(p.code, p.price_kobo) },
                  ])
                }
                disabled={request.isPending}
              />
            )}
          </View>
        );
      })}
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      <AppText variant="caption">Prices are introductory and may change. You will always see the price before paying.</AppText>
    </Card>
  );
}

export default function BusinessScreen() {
  const { session } = useAuth();
  const mine = useMyBusiness();
  const [editing, setEditing] = useState(false);

  if (!session) {
    return (
      <Screen>
        <Notice tone="warning" title="Log in to set up a business." />
        <Button label="Log in" onPress={() => router.push('/auth/sign-in')} />
      </Screen>
    );
  }
  if (mine.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  const business = mine.data?.business ?? null;

  return (
    <Screen>
      <AppText variant="heading">{BRAND.businessName}</AppText>
      {!business || editing ? (
        <>
          <AppText muted>
            {business ? 'Update your storefront details.' : 'Create a free storefront for your shop. Your items appear under your business name.'}
          </AppText>
          <BusinessForm business={business} onSaved={() => setEditing(false)} />
        </>
      ) : (
        <>
          {business.status === 'suspended' ? <Notice tone="danger" title="This business is suspended. Contact Mojere Market support." /> : null}
          <Card>
            <AppText variant="title">{business.name}</AppText>
            {business.description ? <AppText muted>{business.description}</AppText> : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="View storefront" onPress={() => router.push({ pathname: '/business/[slug]', params: { slug: business.slug } })} style={{ flex: 1 }} />
              <Button label="Edit" kind="outline" onPress={() => setEditing(true)} style={{ flex: 1 }} />
            </View>
          </Card>
          <PlanSection subscriptions={mine.data?.subscriptions ?? []} />
          <Card>
            <AppText variant="title">Selling as your business</AppText>
            <AppText variant="small" muted>
              When you sell an item, switch on “List under my business”. Promote items from My listings to reach more buyers.
            </AppText>
            <Button label="My listings and performance" kind="outline" onPress={() => router.push('/my-listings')} />
          </Card>
        </>
      )}
    </Screen>
  );
}
