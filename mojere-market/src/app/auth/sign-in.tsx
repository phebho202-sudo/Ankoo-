import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { TextField } from '@/components/form';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Notice, Screen } from '@/components/ui';
import { friendlyAuthError } from '@/lib/auth';
import { leaveAuthFlow } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { signInSchema, type SignInValues } from '@/lib/validation';
import { colors, spacing } from '@/theme';

export default function SignInScreen() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState, getValues } = useForm<SignInValues, unknown, ReturnType<typeof signInSchema.parse>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        router.push({ pathname: '/auth/verify-email', params: { email } });
        return;
      }
      setServerError(friendlyAuthError(error.message));
      return;
    }
    leaveAuthFlow('/profile');
  });

  return (
    <Screen>
      <AppText variant="heading">Welcome back</AppText>
      <SetupNotice />

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            secure
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
            onSubmitEditing={() => void onSubmit()}
          />
        )}
      />

      {serverError ? <Notice tone="danger" title={serverError} /> : null}

      <Button label="Log in" onPress={onSubmit} loading={isSubmitting} disabled={!supabase} />
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <Link
          href={{ pathname: '/auth/forgot-password', params: { email: getValues('email') } }}
          style={{ color: colors.primary, fontWeight: '600' }}>
          Forgot your password?
        </Link>
        <Link href="/auth/sign-up" replace style={{ color: colors.primary, fontWeight: '600' }}>
          New to Mojere Market? Create an account
        </Link>
      </View>
    </Screen>
  );
}
