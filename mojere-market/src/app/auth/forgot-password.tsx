import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { TextField } from '@/components/form';
import { AppText, Button, Notice, Screen } from '@/components/ui';
import { friendlyAuthError } from '@/lib/auth';
import { leaveAuthFlow } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import {
  emailOnlySchema,
  resetPasswordSchema,
  type EmailOnlyValues,
  type ResetPasswordValues,
} from '@/lib/validation';

/**
 * Two steps on one screen:
 * 1. Enter your email → Supabase emails a reset code.
 * 2. Enter the code and a new password.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailForm = useForm<EmailOnlyValues, unknown, ReturnType<typeof emailOnlySchema.parse>>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: params.email ?? '' },
  });
  const resetForm = useForm<ResetPasswordValues, unknown, ReturnType<typeof resetPasswordSchema.parse>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  });

  const sendCode = emailForm.handleSubmit(async ({ email }) => {
    setServerError(null);
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setServerError(friendlyAuthError(error.message));
      return;
    }
    // For privacy we show the same message whether or not the email has an account.
    setSentTo(email);
  });

  const resetPassword = resetForm.handleSubmit(async ({ code, password }) => {
    setServerError(null);
    if (!supabase || !sentTo) return;
    const verified = await supabase.auth.verifyOtp({ email: sentTo, token: code, type: 'recovery' });
    if (verified.error) {
      setServerError(friendlyAuthError(verified.error.message));
      return;
    }
    const updated = await supabase.auth.updateUser({ password });
    if (updated.error) {
      setServerError(friendlyAuthError(updated.error.message));
      return;
    }
    leaveAuthFlow('/profile');
  });

  if (!sentTo) {
    return (
      <Screen>
        <AppText variant="heading">Reset your password</AppText>
        <AppText muted>Enter the email you signed up with. We will send you a reset code.</AppText>
        <Controller
          control={emailForm.control}
          name="email"
          render={({ field }) => (
            <TextField
              label="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={field.value}
              onChangeText={field.onChange}
              error={emailForm.formState.errors.email?.message}
            />
          )}
        />
        {serverError ? <Notice tone="danger" title={serverError} /> : null}
        <Button label="Send reset code" onPress={sendCode} loading={emailForm.formState.isSubmitting} disabled={!supabase} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="heading">Choose a new password</AppText>
      <AppText muted>
        If an account exists for {sentTo}, a code is on its way. Check your inbox and spam folder.
      </AppText>
      <Controller
        control={resetForm.control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Code from the email"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            value={field.value}
            onChangeText={field.onChange}
            error={resetForm.formState.errors.code?.message}
          />
        )}
      />
      <Controller
        control={resetForm.control}
        name="password"
        render={({ field }) => (
          <TextField
            label="New password"
            secure
            hint="At least 8 characters, with letters and numbers."
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            error={resetForm.formState.errors.password?.message}
          />
        )}
      />
      <Controller
        control={resetForm.control}
        name="confirmPassword"
        render={({ field }) => (
          <TextField
            label="Type the new password again"
            secure
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            error={resetForm.formState.errors.confirmPassword?.message}
          />
        )}
      />
      {serverError ? <Notice tone="danger" title={serverError} /> : null}
      <Button label="Save new password" onPress={resetPassword} loading={resetForm.formState.isSubmitting} />
      <Button label="Use a different email" kind="outline" onPress={() => setSentTo(null)} />
    </Screen>
  );
}
