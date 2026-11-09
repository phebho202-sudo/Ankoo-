// Mojere Market — start a Paystack payment.
//
// Called by the app with the signed-in user's login token. It:
//   1. checks who the user is,
//   2. asks the database for the price (never trusts the app),
//   3. records the payment, and
//   4. asks Paystack for a secure checkout link.
// Nothing is marked as paid here: that only happens in paystack-webhook,
// after Paystack confirms the money arrived.
//
// Needs the secret PAYSTACK_SECRET_KEY (Supabase → Edge Functions → Secrets).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { json, parseInitializeRequest, PAYSTACK_API } from '../_shared/paystack.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    return json({ error: 'payments_not_configured', message: 'Payments are not switched on yet.' }, 503);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json({ error: 'not_signed_in' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const request = parseInitializeRequest(body);
  if (!request) return json({ error: 'bad_request' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: rows, error: payError } = await admin.rpc('mm_create_payment', {
    p_user_id: userData.user.id,
    p_purpose: request.purpose,
    p_target_id: request.targetId,
  });
  const payment = Array.isArray(rows) ? rows[0] : null;
  if (payError || !payment) {
    return json({ error: 'cannot_create_payment', message: payError?.message ?? 'Nothing is waiting for payment.' }, 400);
  }

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payment.email,
      amount: payment.amount_kobo, // kobo, from the database
      currency: 'NGN',
      reference: payment.reference,
      metadata: { purpose: request.purpose, target_id: request.targetId, user_id: userData.user.id },
    }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.status || !result?.data?.authorization_url) {
    await admin.from('payment_records').update({ status: 'failed', provider_response: result }).eq('reference', payment.reference);
    return json({ error: 'paystack_error', message: result?.message ?? 'Paystack could not start the payment.' }, 502);
  }

  return json({ authorizationUrl: result.data.authorization_url, reference: payment.reference });
});
