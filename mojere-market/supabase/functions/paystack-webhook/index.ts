// Mojere Market — receive payment confirmations from Paystack.
//
// Paystack calls this address after a payment. It:
//   1. rejects anything without a valid Paystack signature,
//   2. double-checks the payment directly with Paystack,
//   3. marks the payment as paid ONCE (repeat deliveries are ignored), and
//   4. switches on the promotion or business plan that was paid for.
//
// In Supabase, turn OFF "Enforce JWT verification" for this function:
// Paystack does not log in; the signature check protects it instead.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { json, parseChargeSuccess, PAYSTACK_API, verifyPaystackSignature } from '../_shared/paystack.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) return json({ error: 'payments_not_configured' }, 503);

  const raw = await req.text();
  const valid = await verifyPaystackSignature(raw, req.headers.get('x-paystack-signature'), secret);
  if (!valid) return json({ error: 'invalid_signature' }, 401);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const charge = parseChargeSuccess(payload);
  if (!charge) return json({ received: true }); // other events are acknowledged and ignored

  // Never trust the webhook body alone: ask Paystack directly.
  const verify = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(charge.reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const verified = await verify.json().catch(() => null);
  const data = verified?.data;
  if (!verify.ok || !verified?.status || data?.status !== 'success') {
    return json({ error: 'not_verified' }, 400);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: outcome, error } = await admin.rpc('mm_process_payment', {
    p_reference: data.reference,
    p_paid_kobo: data.amount,
    p_currency: data.currency,
    p_provider_response: {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      paid_at: data.paid_at,
      channel: data.channel,
      gateway_response: data.gateway_response,
    },
  });
  if (error) return json({ error: 'processing_failed' }, 500); // Paystack will retry

  return json({ received: true, outcome });
});
