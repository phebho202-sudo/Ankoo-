import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Checkbox, TextField } from '@/components/form';
import { SetupNotice } from '@/components/setup-notice';
import { AppText, Button, Notice, Screen } from '@/components/ui';
import { friendlyAuthError } from '@/lib/auth';
import { leaveAuthFlow } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { signUpSchema, type SignUpValues } from '@/lib/validation';
import { colors } from '@/theme';

export default function SignUpScreen() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignUpValues, unknown, ReturnType<typeof signUpSchema.parse>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (!supabase) return;
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { display_name: values.displayName, terms_accepted: 'true' } },
    });
    if (error) {
      setServerError(friendlyAuthError(error.message));
      return;
    }
    if (data.session) {
      // Email confirmation is switched off in Supabase: the user is signed in already.
      leaveAuthFlow('/edit-profile');
    } else {
      router.replace({ pathname: '/auth/verify-email', params: { email: values.email } });
    }
  });

  return (
    <Screen>
      <AppText variant="heading">Create your account</AppText>
      <SetupNotice />

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Your name"
            hint="Shown to buyers and sellers. You can use a nickname."
            autoComplete="name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />
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
            hint="At least 8 characters, with letters and numbers."
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <TextField
            label="Type the password again"
            secure
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.confirmPassword?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="acceptTerms"
        render={({ field }) => (
          <Checkbox
            label="I accept the Terms and Privacy Policy"
            checked={field.value}
            onChange={field.onChange}
            error={errors.acceptTerms?.message}>
            <AppText variant="small">
              I accept the{' '}
              <Link href="/terms" style={{ color: colors.primary, fontWeight: '700' }}>
                Terms and Privacy Policy
              </Link>
              , and I understand Mojere Market does not hold or protect payments between users.
            </AppText>
          </Checkbox>
        )}
      />

      {serverError ? <Notice tone="danger" title={serverError} /> : null}

      <Button label="Create account" onPress={onSubmit} loading={isSubmitting} disabled={!supabase} />
      <Link href="/auth/sign-in" replace style={{ color: colors.primary, textAlign: 'center', fontWeight: '600' }}>
        Already have an account? Log in
      </Link>
    </Screen>
  );
}
