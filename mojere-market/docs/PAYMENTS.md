# Mojere Market — Payments (Paystack) guide

**Current status: payments are built but switched OFF.** Nobody can be charged until you complete
the steps below *and* decide to go live. Paid plans and promotions can still be requested; they stay
"Waiting for payment" until payment is confirmed or an admin activates them.

## How it works (and why it is safe)

1. The app asks to pay for something (a promotion or a business plan). It never sends a price.
2. The **paystack-initialize** server function checks who is asking, looks up the price **in the
   database**, records a payment with a unique reference, and gets a secure checkout page from Paystack.
3. The customer pays on **Paystack's own page**. Mojere Market never sees or stores card details.
4. Paystack calls the **paystack-webhook** server function. It:
   - rejects anything without a valid **Paystack signature**,
   - asks Paystack again to **verify** the payment,
   - checks the **amount and currency** match exactly,
   - processes each payment reference **only once**, and
   - only then switches on the promotion or plan.
5. A "success" screen on the phone is never trusted on its own.

There is **no escrow**: Mojere Market only takes payments for its own services (promotions and business
plans), never payments between buyers and sellers.

Prices live in the database (`promotion_packages`, `business_plans`) and can be changed by an admin.

---

## Part 1 — Test mode (no real money)

Do this only when you are ready to test payments. Each step is safe: test mode uses fake cards.

1. **Create a Paystack account** at **paystack.com** (free). You can test before your business is verified.
2. In the Paystack dashboard, open **Settings → API Keys & Webhooks**. Make sure the toggle says **Test mode**.
   Copy the **Test Secret Key** (starts with `sk_test_`). **Never** paste it into the app, a chat or GitHub.
3. In **Supabase → Edge Functions → Secrets** (or *Project Settings → Edge Functions*), add a secret:
   - Name: `PAYSTACK_SECRET_KEY`
   - Value: your `sk_test_…` key
4. **Deploy the two server functions** from your laptop (PowerShell, inside `C:\dev\Ankoo-\mojere-market`):

   ```
   npx.cmd supabase login
   npx.cmd supabase link --project-ref xhawmbiehhimusjyqtbw
   npx.cmd supabase functions deploy paystack-initialize
   npx.cmd supabase functions deploy paystack-webhook --no-verify-jwt
   ```

   `--no-verify-jwt` is needed **only for the webhook**: Paystack does not log in to Supabase; the
   signature check protects it instead. If a command mentions Docker, add `--use-api` to the deploy commands.
5. Back in **Paystack → Settings → API Keys & Webhooks**, set the **Test Webhook URL** to:

   ```
   https://xhawmbiehhimusjyqtbw.supabase.co/functions/v1/paystack-webhook
   ```

6. On your laptop, open `.env` and set `EXPO_PUBLIC_PAYMENTS_ENABLED=true`, then restart the app with
   `npx.cmd expo start --tunnel --clear`.
7. Test: promote one of your items → **Pay with Paystack** → use one of Paystack's **test cards**
   (listed in Paystack's documentation under "Test Payments"). After paying, the app should say
   "Payment confirmed" and the item should show **Featured** within a minute.
8. Check **Supabase → Table Editor → payment_records**: the payment shows `success`, once.

## Part 2 — Going live (real money) — only with your explicit decision

Do **not** do this until test mode works end to end and you have decided to start charging.
1. Complete Paystack's **business verification** (business documents and bank account for payouts).
2. Check Paystack's current **fees** on their pricing page and confirm your prices still make sense.
3. Replace the secret `PAYSTACK_SECRET_KEY` in Supabase with the **Live Secret Key** (`sk_live_…`).
4. Set the **Live Webhook URL** in Paystack to the same address as above.
5. Build the release app with `EXPO_PUBLIC_PAYMENTS_ENABLED=true`.
6. Make one small real payment yourself and confirm it arrives in your Paystack balance.

To switch payments off again at any time: set `EXPO_PUBLIC_PAYMENTS_ENABLED=false` in the app, and/or
delete the `PAYSTACK_SECRET_KEY` secret in Supabase (the server then refuses all new payments).

## Without online payments

Admins can activate a requested promotion manually (for example after a cash or bank-transfer payment
you have personally confirmed). This is recorded in the audit log. The button for this arrives with the
admin dashboard (Phase 8).

## Refunds and disputes

Refunds are issued from the Paystack dashboard. Record the outcome by changing the promotion's status to
`refunded` (admin dashboard, Phase 8). Keep Paystack's transaction reference in any correspondence.
