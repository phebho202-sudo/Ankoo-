import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';

import { SelectField, TextField } from '@/components/form';
import { AppText, Button, Notice, Screen } from '@/components/ui';
import { LAUNCH_LGA_SLUG } from '@/constants/ondo';
import { useAuth } from '@/lib/auth';
import { useLocations, useMyProfile, useSaveProfile } from '@/lib/profile';
import { profileSchema, type ProfileValues } from '@/lib/validation';
import { colors } from '@/theme';

export default function EditProfileScreen() {
  const { session, loading: authLoading } = useAuth();
  const profile = useMyProfile();
  const locations = useLocations();
  const save = useSaveProfile();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, formState, reset, setValue } = useForm<
    ProfileValues,
    unknown,
    ReturnType<typeof profileSchema.parse>
  >({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', bio: '', lgaId: '', townId: null, neighbourhood: '' },
  });

  const lgas = useMemo(
    () => (locations.data ?? []).filter((l) => l.kind === 'lga').map((l) => ({ value: l.id, label: l.name })),
    [locations.data],
  );
  const lgaId = useWatch({ control, name: 'lgaId' });
  const towns = useMemo(
    () =>
      (locations.data ?? [])
        .filter((l) => l.kind === 'town' && l.parent_id === lgaId)
        .map((l) => ({ value: l.id, label: l.name })),
    [locations.data, lgaId],
  );

  // Fill the form once the saved profile has loaded.
  useEffect(() => {
    if (profile.isSuccess && locations.isSuccess) {
      const p = profile.data;
      const launchLga = locations.data.find((l) => l.slug === LAUNCH_LGA_SLUG)?.id ?? '';
      reset({
        displayName: p?.display_name ?? '',
        bio: p?.bio ?? '',
        lgaId: p?.lga_id ?? launchLga,
        townId: p?.town_id ?? null,
        neighbourhood: p?.neighbourhood ?? '',
      });
    }
  }, [profile.isSuccess, profile.data, locations.isSuccess, locations.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await save.mutateAsync({
        display_name: v.displayName,
        bio: v.bio || null,
        lga_id: v.lgaId,
        town_id: v.townId,
        neighbourhood: v.neighbourhood || null,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not save your profile. Please try again.');
    }
  });

  if (authLoading || profile.isLoading || locations.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen>
        <Notice tone="warning" title="Please log in to edit your profile." />
        <Button label="Log in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }
  if (locations.isError || profile.isError) {
    return (
      <Screen>
        <Notice tone="danger" title="Could not load your profile">
          <AppText variant="small">Check your internet connection and try again.</AppText>
        </Notice>
        <Button
          label="Try again"
          onPress={() => {
            void profile.refetch();
            void locations.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText muted>
        Buyers and sellers see your name and general area — never your exact address.
      </AppText>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField label="Your name" value={field.value} onChangeText={field.onChange} error={formState.errors.displayName?.message} />
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
            placeholder={towns.length ? 'Choose your town' : 'Choose an LGA first'}
          />
        )}
      />
      <Controller
        control={control}
        name="neighbourhood"
        render={({ field }) => (
          <TextField
            label="Area or neighbourhood (optional)"
            hint="General area only, e.g. “FUTA South Gate” or “Alagbaka”. Do not enter your house address."
            value={field.value}
            onChangeText={field.onChange}
            error={formState.errors.neighbourhood?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <TextField
            label="About you (optional)"
            multiline
            maxLength={300}
            value={field.value}
            onChangeText={field.onChange}
            error={formState.errors.bio?.message}
          />
        )}
      />

      {serverError ? <Notice tone="danger" title={serverError} /> : null}
      <View>
        <Button label="Save profile" onPress={onSubmit} loading={formState.isSubmitting} />
      </View>
    </Screen>
  );
}
