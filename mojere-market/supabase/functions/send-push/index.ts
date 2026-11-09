// Mojere Market — send a phone alert when an in-app notification is created.
//
// Triggered by a Supabase Database Webhook on INSERT into public.notifications
// (see docs/PUSH_NOTIFICATIONS.md). It checks a shared secret, respects the
// user's "push" setting, sends through Expo's push service, and removes
// tokens for phones that uninstalled the app.
//
// Secrets: PUSH_WEBHOOK_SECRET (any long random text you choose).

import { createClient } from 'npm:@supabase/supabase-js@2';

import { json, safeEqual } from '../_shared/paystack.ts';
import { buildPushMessages, deadTokens, EXPO_PUSH_URL, parseNotificationInsert } from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || !safeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) return json({ error: 'unauthorised' }, 401);

  const n = parseNotificationInsert(await req.json().catch(() => null));
  if (!n) return json({ skipped: 'not a notification insert' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: prefs } = await admin.from('notification_preferences').select('push_enabled').eq('user_id', n.user_id).maybeSingle();
  if (prefs && prefs.push_enabled === false) return json({ skipped: 'push turned off by user' });

  const { data: rows } = await admin.from('push_tokens').select('token').eq('user_id', n.user_id);
  const messages = buildPushMessages(n, (rows ?? []).map((r: { token: string }) => r.token));
  if (!messages.length) return json({ skipped: 'no devices' });

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await res.json().catch(() => null);
  const dead = deadTokens(messages, result?.data);
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);

  return json({ sent: messages.length, removed: dead.length });
});
