# Mojere Market — Launch and growth plan

Only you can do most of these steps: they use your own accounts, payments and signatures.
Prices and limits change, so check each provider's current pricing page before paying.

## Part 1 — Must fix before inviting the public

| # | Blocker | Why it matters at 30,000 people | What to do |
|---|---|---|---|
| 1 | **Email codes are sent from Gmail** | Gmail only sends a few hundred emails a day. With 1,000 sign-ups a day, most people would never get their code and could not join. | Switch Supabase SMTP to a transactional email service (e.g. Brevo, Resend, Amazon SES, Zoho ZeptoMail) with your own domain. 💳 Usually a small monthly fee at this volume. |
| 2 | **Supabase free plan** | Free projects have limited file storage and bandwidth (photos fill this fast), limited backups, and pause when idle. | 💳 Upgrade to **Supabase Pro** before launch. Then set a spending cap in Billing. |
| 3 | **Privacy Policy and Terms** | Both app stores require a public privacy-policy link. The Nigeria Data Protection Act 2023 also applies. | Have a Nigerian lawyer review `src/app/terms.tsx`, then publish the final text on a simple web page (e.g. a free Google Sites page or your own domain). |
| 4 | **Domain and support email** | Trust, store listings, and email codes not landing in spam. | 💳 Buy a domain (e.g. mojeremarket.ng or .com.ng) and create `support@` and `hello@` addresses. |
| 5 | **Untested on real phones** | Two-account messaging, reports and installed builds have not been tried yet. | Do the checks in `docs/TESTING.md` with 5–10 friends before launch day. |

## Part 2 — Getting the app to people

**Most buyers and sellers in Ondo use Android phones, so start with Android.**

1. **Android test app (free).** Follow `docs/ANDROID_BUILD.md` to make a preview APK. Share the
   download link with 20–50 trusted testers (friends, FUTA students).
2. **Google Play (💳 one-time fee).** Create a Google Play Console account.
   - **Important timing rule:** new *personal* developer accounts must run a **closed test with
     at least 12 testers for 14 days in a row** before Google lets you publish to everyone.
     An *organisation* account (needs a registered business and a free D-U-N-S number) skips this
     rule but takes longer to verify. Start this **on day 1**: it is the slowest step.
   - Use the testers from step 1 as your 12+ closed testers.
3. **iPhone (💳 Apple Developer Program, about US$99/year).** Follow `docs/IOS_BUILD.md` when ready.
   Apple's review usually takes a few days. Launch Android first if money is tight.
4. **Push alerts.** Set them up on the first installed build (`docs/PUSH_NOTIFICATIONS.md`).

Realistic timeline: **week 1** fixes in Part 1 + test APK; **weeks 2–3** Google closed test (14 days);
**week 3–4** public on Google Play (and the App Store if enrolled). Growth work in Part 3 starts on day 1,
so people are waiting when the app goes live.

## Part 3 — Growth strategy for Akure and Ondo State

### Honest target
30,000 people in one month is very ambitious for a brand-new local app. It is possible only with a
strong campus push **and** paid advertising. A good first-month result without ads is a few thousand
active users. Aim for 30,000 **sign-ups over 2–3 months**, and track how many people actually list or buy.

### Rule 1: sellers first
A marketplace with no items loses visitors forever. Before the public launch, get **500+ real listings**
from real sellers. Never create fake listings, reviews or users.

### The plan

**Weeks 1–2: supply (sellers)**
- **Campus ambassadors** at FUTA first, then AAUA (Akungba), OSUSTECH (Okitipupa), the University of Medical
  Sciences (Ondo) and Adeyemi Federal University of Education (Ondo). Recruit 2–5 per hostel or faculty.
  Pay a small fee per **verified active seller** (someone who published a real item), not per download.
- **"Declutter Week"** at the end of a semester: students leaving hostels sell fans, mattresses, gas
  cylinders, books and phones. This is what the Declutter feature was built for. Help them post on the spot.
- **Market traders and small shops** in Oja Oba, Isikan, Oba Adesida Road and Alagbaka: sign up 100 shops
  with a free Business storefront. Offer to take photos and post their first 10 items for them.
- **Free featured placements for early sellers.** You activate them yourself in the admin dashboard,
  so it costs nothing. Record each one as a "launch gift" in the reason box.

**Weeks 2–4: demand (buyers)**
- **WhatsApp:** this is where your audience already is. Each ambassador shares new item links daily in
  hostel, department and estate groups (with the group admin's permission). Sellers share their
  storefront link on their WhatsApp Status.
- **Short videos on TikTok and Instagram Reels:** "What ₦5,000 buys on Mojere Market", seller stories,
  safe meetup tips. Post daily. Work with 3–5 Akure content creators.
- **Paid ads (💳):** Meta (Facebook/Instagram) and TikTok ads targeted to Ondo State, ages 18–40, pointing
  to the Play Store page. Start small, then keep only the ads with the lowest cost per sign-up.
- **Local radio** (e.g. Adaba FM, OSBC) with a Yoruba-language segment on safe buying and selling.
- **Physical flyers with a QR code** at hostels, cafés, viewing centres, salons and phone shops.

**Retention (all month)**
- Answer every report within a day (Admin → Reports). One scam story can stop your growth.
- Promote the **safe meetup spots** loudly: safety is your advantage over random WhatsApp sellers.
- Message your first 500 sellers personally and ask what would make them post more.

### What to measure every week
Admin dashboard: new listings, conversations, confirmed sales, open reports.
Play Console: installs and uninstalls. Your goal is **real sales**, not just downloads.

## Part 4 — Features that would help growth (ask your developer)
- **Share buttons** on items and storefronts (WhatsApp share with a link).
- **Referral codes** for ambassadors so you can see who brought each seller.
- **A website version** so links open even for people who have not installed the app.
These are not built yet.
