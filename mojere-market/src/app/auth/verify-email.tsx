import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { TextField } from '@/components/form';
import { AppText, Button, Notice, Screen } from '@/components/ui';
import { friendlyAuthError } from '@/lib/auth';
import { leaveAuthFlow } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { verifyCodeSchema, type VerifyCodeValues } from '@/lib/validation';

const RESEND_WAIT_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const { control, handleSubmit, formState } = useForm<VerifyCodeValues, unknown, ReturnType<typeof verifyCodeSchema.parse>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async ({ code }) => {
    setServerError(null);
    if (!supabase || !email) return;
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      setServerError(friendlyAuthError(error.message));
      return;
    }
    leaveAuthFlow('/edit-profile');
  });

  async function resend() {
    if (!supabase || !email) return;
    setResending(true);
    setServerError(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) setServerError(friendlyAuthError(error.message));
    else {
      setInfo('A new code is on its way. Check your inbox and spam folder.');
      setWait(RESEND_WAIT_SECONDS);
    }
  }

  return (
    <Screen>
      <AppText variant="heading">Confirm your email</AppText>
      <AppText>
        We sent a code to <AppText style={{ fontWeight: '700' }}>{email || 'your email'}</AppText>. Type it below.
        It can take a few minutes to arrive — also check your spam or promotions folder.
      </AppText>

      <Controller
        control={control}
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
            error={formState.errors.code?.message}
          />
        )}
      />

      {serverError ? <Notice tone="danger" title={serverError} /> : null}
      {info ? <Notice title={info} /> : null}

      <Button label="Confirm email" onPress={onSubmit} loading={formState.isSubmitting} disabled={!email} />
      <Button
        label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        kind="outline"
        onPress={resend}
        loading={resending}
        disabled={wait > 0 || !email}
      />
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        Never share this code with anyone. Mojere Market staff will never ask for it.
      </AppText>
    </Screen>
  );
}
