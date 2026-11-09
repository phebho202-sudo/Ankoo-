import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Modal, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/filter-sheet';
import { SelectField, TextField } from '@/components/form';
import { conditionLabel, ListingPhoto } from '@/components/listing-card';
import { PhotoPicker } from '@/components/photo-picker';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { CONDITIONS } from '@/constants/catalog';
import { useAuth } from '@/lib/auth';
import { useMyBusiness } from '@/lib/business';
import { addToDeclutterSession } from '@/lib/declutter';
import { formatNaira, parseNairaToKobo } from '@/lib/format';
import type { PhotoItem } from '@/lib/photos';
import { useLocations, useMyProfile } from '@/lib/profile';
import { missingForPublish, saveListing, useCategories, useInvalidateListings, useMyListing } from '@/lib/selling';
import { listingSchema, type ListingFormValues } from '@/lib/validation';
import { colors, spacing } from '@/theme';

type Parsed = ReturnType<typeof listingSchema.parse>;

/**
 * Create or edit a listing.
 *   /listing-editor              → new listing
 *   /listing-editor?id=…         → edit an existing listing
 *   /listing-editor?session=…    → add an item to a Declutter My Home session (saved as a draft)
 */
export default function ListingEditorScreen() {
  const { id, session: sessionId } = useLocalSearchParams<{ id?: string; session?: string }>();
  const { session, loading: authLoading } = useAuth();
  const profile = useMyProfile();
  const existing = useMyListing(id);
  const isEdit = !!id;

  if (authLoading || (isEdit ? existing.isLoading : profile.isLoading)) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen>
        <Notice tone="warning" title="Please log in to sell on Mojere Market." />
        <Button label="Log in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }
  if (isEdit && !existing.data) {
    return (
      <Screen>
        <Notice tone="danger" title="This listing could not be found." />
      </Screen>
    );
  }
  if (existing.data?.status === 'removed') {
    return (
      <Screen>
        <Notice tone="danger" title="This listing was removed by Mojere Market and cannot be edited." />
      </Screen>
    );
  }

  const l = existing.data;
  const p = profile.data;
  const initial: ListingFormValues = l
    ? {
        title: l.title,
        description: l.description,
        categoryId: l.category_id,
        condition: l.condition,
        price: String(l.price_kobo / 100),
        isNegotiable: l.is_negotiable,
        lgaId: l.lga_id,
        townId: l.town_id,
        neighbourhood: l.neighbourhood ?? '',
      }
    : {
        title: '',
        description: '',
        categoryId: '',
        price: '',
        isNegotiable: true,
        lgaId: p?.lga_id ?? '',
        townId: p?.town_id ?? null,
        neighbourhood: p?.neighbourhood ?? '',
      } as ListingFormValues;
  const initialPhotos: PhotoItem[] = (l?.listing_images ?? []).map((img) => ({
    key: img.storage_path,
    path: img.storage_path,
  }));

  return (
    <EditorForm
      key={l?.id ?? 'new'}
      userId={session.user.id}
      listingId={id}
      sessionId={sessionId}
      status={l?.status ?? null}
      initial={initial}
      initialPhotos={initialPhotos}
      initialBusinessId={l ? l.business_id : undefined}
    />
  );
}

function EditorForm({
  userId,
  listingId: id,
  sessionId,
  status,
  initial,
  initialPhotos,
  initialBusinessId,
}: {
  userId: string;
  listingId?: string;
  sessionId?: string;
  status: string | null;
  initial: ListingFormValues;
  initialPhotos: PhotoItem[];
  /** undefined = new listing (default to the business if the seller has one). */
  initialBusinessId?: string | null;
}) {
  const locations = useLocations();
  const categories = useCategories();
  const invalidate = useInvalidateListings();

  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const myBusiness = useMyBusiness();
  const business = myBusiness.data?.business ?? null;
  const [useBusiness, setUseBusiness] = useState<boolean | null>(
    initialBusinessId === undefined ? null : !!initialBusinessId,
  );
  const listUnderBusiness = !!business && business.status === 'active' && (useBusiness ?? true);
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [preview, setPreview] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = !!id;
  const isDeclutter = !!sessionId;

  const { control, handleSubmit, reset, setValue, formState, getValues } = useForm<ListingFormValues, unknown, Parsed>({
    resolver: zodResolver(listingSchema),
    defaultValues: initial,
  });
  const lgaId = useWatch({ control, name: 'lgaId' });

  const lgas = useMemo(
    () => (locations.data ?? []).filter((l) => l.kind === 'lga').map((l) => ({ value: l.id, label: l.name })),
    [locations.data],
  );
  const towns = useMemo(
    () =>
      (locations.data ?? [])
        .filter((l) => l.kind === 'town' && l.parent_id === lgaId)
        .map((l) => ({ value: l.id, label: l.name })),
    [locations.data, lgaId],
  );
  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );

  async function save(values: Parsed, publish: boolean, addAnother = false) {
    setServerError(null);
    setBusy('Saving…');
    try {
      const listingId = await saveListing({
        userId,
        listingId: id,
        values: {
          title: values.title,
          description: values.description,
          categoryId: values.categoryId,
          condition: values.condition,
          priceKobo: parseNairaToKobo(values.price) ?? 0,
          isNegotiable: values.isNegotiable,
          lgaId: values.lgaId,
          townId: values.townId,
          neighbourhood: values.neighbourhood,
          businessId: listUnderBusiness ? business!.id : null,
        },
        photos,
        publish,
        onProgress: setBusy,
      });
      if (sessionId) await addToDeclutterSession(sessionId, listingId);
      await invalidate();
      setPreview(null);
      if (addAnother) {
        reset({ ...getValues(), title: '', description: '', price: '', categoryId: '', condition: undefined });
        setPhotos([]);
        setBusy(null);
        return;
      }
      setBusy(null);
      if (sessionId) router.back();
      else if (publish) router.replace({ pathname: '/listing/[id]', params: { id: listingId } });
      else router.replace('/my-listings');
    } catch (e) {
      setBusy(null);
      setServerError(
        e instanceof Error ? `${e.message} Nothing was published. Please try again.` : 'Could not save. Please try again.',
      );
    }
  }

  const openPreview = handleSubmit((values) => {
    const missing = missingForPublish({ ...values, photoCount: photos.length });
    if (missing.length) {
      setPhotoError(photos.length ? undefined : 'Add at least one photo before publishing.');
      setServerError(`Before publishing, add ${missing.join(', ')}.`);
      return;
    }
    setPhotoError(undefined);
    setServerError(null);
    setPreview(values);
  });
  const saveDraft = handleSubmit((values) => save(values, false));
  const saveDraftAndAddAnother = handleSubmit((values) => save(values, false, true));

  const title = isDeclutter ? 'Add a declutter item' : isEdit ? 'Edit listing' : 'Sell an item';
  const isPublished = !!status && status !== 'draft';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        {isDeclutter ? (
          <Notice title="Your unused items could make someone else’s day.">
            <AppText variant="small">Save each item as a draft. You can review and publish them together.</AppText>
          </Notice>
        ) : null}

        <PhotoPicker photos={photos} onChange={setPhotos} error={photoError} />

        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <TextField
              label="Title"
              placeholder="e.g. Wooden study table"
              maxLength={80}
              value={field.value}
              onChangeText={field.onChange}
              error={formState.errors.title?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <SelectField
              label="Category"
              value={field.value || null}
              options={categoryOptions}
              onChange={(v) => field.onChange(v ?? '')}
              error={formState.errors.categoryId?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="condition"
          render={({ field }) => (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="small" style={{ fontWeight: '600' }}>
                Condition
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {CONDITIONS.map((c) => (
                  <Chip key={c.value} label={c.label} selected={field.value === c.value} onPress={() => field.onChange(c.value)} />
                ))}
              </View>
              {formState.errors.condition ? (
                <AppText variant="caption" style={{ color: colors.danger }}>
                  {formState.errors.condition.message}
                </AppText>
              ) : null}
            </View>
          )}
        />
        <Controller
          control={control}
          name="price"
          render={({ field }) => (
            <TextField
              label="Price (₦)"
              placeholder="e.g. 15000"
              keyboardType="number-pad"
              value={field.value}
              onChangeText={field.onChange}
              error={formState.errors.price?.message}
              hint={field.value && parseNairaToKobo(field.value) != null ? formatNaira(parseNairaToKobo(field.value)!) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="isNegotiable"
          render={({ field }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }}>Price is negotiable</AppText>
                <AppText variant="caption">Buyers can make you an offer.</AppText>
              </View>
              <Switch
                accessibilityLabel="Price is negotiable"
                value={field.value}
                onValueChange={field.onChange}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              label="Description"
              placeholder="Size, colour, age, any faults, why you are selling…"
              multiline
              maxLength={2000}
              value={field.value}
              onChangeText={field.onChange}
              error={formState.errors.description?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="lgaId"
          render={({ field }) => (
            <SelectField
              label="Local government area"
              value={field.value || null}
              options={lgas}
              onChange={(v) => {
                field.onChange(v ?? '');
                setValue('townId', null);
              }}
              error={formState.errors.lgaId?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="townId"
          render={({ field }) => (
            <SelectField
              label="Town (optional)"
              value={field.value}
              options={towns}
              onChange={field.onChange}
              allowClear
              placeholder={towns.length ? 'Choose a town' : 'Choose an LGA first'}
            />
          )}
        />
        <Controller
          control={control}
          name="neighbourhood"
          render={({ field }) => (
            <TextField
              label="Area (optional)"
              hint="General area only, e.g. “FUTA South Gate”. Never your house address."
              maxLength={80}
              value={field.value}
              onChangeText={field.onChange}
              error={formState.errors.neighbourhood?.message}
            />
          )}
        />

        {business && business.status === 'active' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '600' }}>List under my business</AppText>
              <AppText variant="caption">Shows on {business.name}’s storefront.</AppText>
            </View>
            <Switch
              accessibilityLabel="List under my business"
              value={listUnderBusiness}
              onValueChange={setUseBusiness}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ) : null}

        {serverError ? <Notice tone="danger" title={serverError} /> : null}
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="small">{busy}</AppText>
          </View>
        ) : null}

        {isDeclutter ? (
          <>
            <Button label="Save item" onPress={saveDraft} loading={!!busy} />
            <Button label="Save and add another" kind="outline" onPress={saveDraftAndAddAnother} disabled={!!busy} />
          </>
        ) : (
          <>
            <Button
              label={isPublished ? 'Preview and save changes' : 'Preview and publish'}
              kind="accent"
              onPress={openPreview}
              disabled={!!busy}
            />
            {!isPublished ? (
              <Button label="Save as draft" kind="outline" onPress={saveDraft} loading={!!busy && !preview} />
            ) : null}
          </>
        )}
        <AppText variant="caption">
          By publishing you confirm you own this item and it is allowed to be sold. Mojere Market does not hold
          payments between buyers and sellers.
        </AppText>
      </Screen>

      <Modal visible={!!preview} animationType="slide" onRequestClose={() => setPreview(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {preview ? (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              <AppText variant="heading">Preview</AppText>
              <AppText muted>This is how buyers will see your item.</AppText>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {photos[0]?.uri ? (
                  <PreviewPhoto uri={photos[0].uri} />
                ) : (
                  <ListingPhoto path={photos[0]?.path} style={{ width: '100%', aspectRatio: 1 }} />
                )}
                <View style={{ padding: spacing.md, gap: spacing.xs }}>
                  <AppText variant="heading">{formatNaira(parseNairaToKobo(preview.price) ?? 0)}</AppText>
                  <AppText variant="title">{preview.title}</AppText>
                  <AppText variant="small" muted>
                    {conditionLabel(preview.condition)}
                    {preview.isNegotiable ? ' · Negotiable' : ''} · {photos.length} photo{photos.length === 1 ? '' : 's'}
                  </AppText>
                  {preview.description ? <AppText>{preview.description}</AppText> : null}
                </View>
              </Card>
              {serverError ? <Notice tone="danger" title={serverError} /> : null}
              {busy ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <ActivityIndicator color={colors.primary} />
                  <AppText variant="small">{busy}</AppText>
                </View>
              ) : null}
              <Button
                label={isPublished ? 'Save changes' : 'Publish now'}
                kind="accent"
                onPress={() => void save(preview, !isPublished || status === 'active')}
                loading={!!busy}
              />
              <Button label="Back to editing" kind="outline" onPress={() => setPreview(null)} disabled={!!busy} />
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

function PreviewPhoto({ uri }: { uri: string }) {
  // Newly picked photos are still on the phone, so show them directly.
  return <Image source={{ uri }} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" />;
}
