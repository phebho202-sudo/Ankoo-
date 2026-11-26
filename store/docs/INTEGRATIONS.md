# Integrations

## Payments: Paystack (recommended)

**Why Paystack over Flutterwave for ANKOO:** both are reputable Nigerian gateways. Paystack is the better fit here because:
- It settles in NGN to a Nigerian bank account, and its hosted checkout offers the methods Nigerian customers use most: cards, bank transfer, USSD and others enabled on your account.
- International customers can pay with Visa/Mastercard (and other methods Paystack enables for your account). They are charged in NGN and their bank converts.
- The integration is simple and well documented, with signed webhooks. This store uses the redirect checkout, so card details are entered on Paystack's page and never touch ANKOO's server.

Check current fees and international-payment eligibility on Paystack's pricing page before going live. The store is built so another gateway could be added later in `src/paystack.js` and `src/routes/checkout.js`. All prices are stored in kobo, and orders carry a currency field.

**Setup**
1. Create a Paystack business account and complete verification (CAC registration raises limits).
2. Settings → API Keys & Webhooks: copy the **secret key** into `PAYSTACK_SECRET_KEY` on the host (start with the test key).
3. Set the webhook URL to `https://YOUR-DOMAIN/webhooks/paystack` (test and live).
4. Make a test purchase with Paystack's test card, then switch to the live key.

How it is protected: the server recalculates every total, verifies each transaction with Paystack, checks the amount and currency before marking an order paid, verifies webhook signatures (HMAC-SHA512), and processes payments idempotently, so the callback and the webhook can both arrive safely.

**International prices:** in Admin → Settings → International prices, add lines such as `USD=1600` (naira per dollar). Visitors can then choose to see approximate prices in that currency. Payment is always in NGN.

## Email: Resend

Order confirmations, status updates, password resets, admin new-order alerts and contact-form messages.
1. Create an account at resend.com, add and verify your domain (DNS records).
2. Set `RESEND_API_KEY`, `MAIL_FROM` (e.g. `ANKOO <orders@yourdomain.com>`) and optionally `ORDER_NOTIFY_EMAIL` (otherwise new-order alerts go to the business email in Settings).
3. Admin → Email log shows every email and whether it was sent.

## WhatsApp

**Click-to-chat (works immediately):** add the WhatsApp number in Admin → Settings. Every page gets a floating button. Product pages pre-fill the product link, the bag pre-fills the order, order pages pre-fill the order number, and bespoke products say "Discuss a bespoke fitting".

**Automated replies around the clock (optional, WhatsApp Cloud API):**
1. In Meta for Developers, create an app with the WhatsApp product and add your business number. A number used in the WhatsApp Business app must be migrated, so check Meta's current rules first.
2. Set `WHATSAPP_TOKEN` (a permanent system-user token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` and a random `WHATSAPP_VERIFY_TOKEN`.
3. Set the webhook callback URL to `https://YOUR-DOMAIN/webhooks/whatsapp`, enter the same verify token, and subscribe to `messages`.

The assistant recognises greetings and questions about sizing, delivery, bespoke orders, returns, prices and order status. It answers only with the texts in Admin → Settings → Customer support, plus the returns policy. Order status is shared only when the message comes from the phone number on the order. Anything else gets the hand-over message for your team. Conversations are logged in Admin → WhatsApp log. It never promises refunds, exchanges or delivery dates.

If you prefer to stay on the WhatsApp Business app, use its greeting and away messages and quick replies, with the same approved texts.

## Analytics and advertising

- **Google Analytics 4:** add the measurement ID (G-…) in Admin → Settings. The site tracks page views, `view_item`, `add_to_cart`, `begin_checkout` and `purchase`.
- **Meta Pixel:** add the Pixel ID. The site tracks `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout` and `Purchase` with product IDs, values in NGN and the order number, ready for Instagram and Facebook campaigns.
- **Consent:** with "Ask visitors for cookie consent" on (the default, in line with the Nigeria Data Protection Act), analytics load only after a visitor accepts.
- **Meta Commerce Manager / Instagram Shopping and Google Merchant Center:** add the data feed `https://YOUR-DOMAIN/feeds/products.csv` (scheduled fetch). Each size and colour is an item, grouped by product. Product IDs match the Pixel's content IDs, which is what dynamic ads need.
- **Ads to products:** every product and collection has a short, permanent link (`/product/…`, `/collections/…`). UTM parameters are kept for analytics.
- **Google Search Console:** verify with the HTML-tag code in Admin → Settings, then submit `https://YOUR-DOMAIN/sitemap.xml`.

## Instagram feed

By default, the homepage grid shows the posts you curate in Admin → Instagram. For a live feed, set `INSTAGRAM_ACCESS_TOKEN` (Instagram API with Instagram Login, professional account). Tokens expire, so refresh them as Meta requires. Without a token, the curated posts are shown.
