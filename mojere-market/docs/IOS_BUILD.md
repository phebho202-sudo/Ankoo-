# Mojere Market — iPhone (App Store) launch guide

You do **not** need a Mac. Expo's cloud service (EAS) builds the iPhone app, and you upload it to Apple
from your Windows laptop.

💳 **Cost:** the **Apple Developer Program** costs about **US$99 per year** (check the current price on
Apple's site). Nothing else in this guide costs money.

**Until you enrol:** keep testing on your iPhone with **Expo Go** (free).

---

## What is already done in the app

- **Delete my account** (Profile → Delete my account). Apple rejects apps that let people sign up but not
  delete their account. Needs database **Part M** in `SUPABASE_SETUP.md`.
- **Report and block** for listings, people and messages, plus **Community guidelines**. Apple requires
  these for apps where users post content.
- **Promotions and paid business plans are hidden on iPhone.** Apple only lets iPhone apps sell digital
  extras (like "boosting" a listing) through Apple's own In-App Purchase. Buying and selling physical
  items between people is allowed without it. Android is not affected.
- Camera and photo permission messages, the encryption declaration, and the app icon.

## Step 1 — Before you pay Apple (free)

1. **Privacy Policy web page.** Apple requires a public link. Have a lawyer review the text in
   `src/app/terms.tsx`, then put it on a free web page (for example **Google Sites**). Copy the link.
2. **Support contact.** Create an email address for support (for example a new Gmail such as
   `mojeremarket.help@gmail.com`). Already done: the app shows mojeremarket.help@gmail.com; send your developer a new address if you change it, because Apple
   asks for a way to contact you.
3. **Database:** run **Part M** in `SUPABASE_SETUP.md` ("Delete my account").
4. **A reviewer account.** Apple's reviewer needs to log in. Create a normal account with an email you
   control (for example `mojeremarket.review@gmail.com`), confirm it, and write down its password **for
   Apple only**. Never put it in the code or chat.
5. **Real listings.** Ask a few real sellers to post real items so the reviewer sees a working
   marketplace. Never post fake items.

## Step 2 — Enrol in the Apple Developer Program 💳

1. Go to **developer.apple.com/programs/enroll** and sign in with your Apple ID. Two-factor
   authentication must be on.
2. Choose:
   - **Individual:** fastest. Your own name appears as the seller on the App Store.
   - **Organisation:** shows "Mojere Market" as the seller, but needs a registered business (CAC) and a
     free D-U-N-S number, and takes longer.
3. Pay the fee and wait for Apple's approval email. This often takes 1–2 days, sometimes longer.

## Step 3 — Give the production build its settings (free)

In PowerShell, inside `C:\dev\Ankoo-\mojere-market`, run these **one at a time**:

```
npx.cmd eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://xhawmbiehhimusjyqtbw.supabase.co --visibility plaintext
```
```
$k = ((Get-Content .env | Where-Object { $_ -match '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' }) -replace '^EXPO_PUBLIC_SUPABASE_ANON_KEY=','').Trim().Trim('"'); $k.Length
```
(It should print a number over 100.)
```
npx.cmd eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value $k --visibility plaintext
```
```
npx.cmd eas-cli@latest env:create --environment production --name EXPO_PUBLIC_PAYMENTS_ENABLED --value false --visibility plaintext
```

## Step 4 — Build the iPhone app

```
npx.cmd eas-cli@latest build --platform ios --profile production
```

- It asks you to **log in to your Apple account**: type your Apple ID and password **into PowerShell
  only**, then the 6-digit code Apple sends to your iPhone.
- Answer **Yes** to creating the **Distribution Certificate**, the **Provisioning Profile** and the
  **Push Notifications key**. EAS stores them safely.
- The build takes about 15–30 minutes in the cloud.

## Step 5 — Upload to Apple (TestFlight)

```
npx.cmd eas-cli@latest submit --platform ios --latest
```

- The first time, it creates the app in **App Store Connect** for you. If the name "Mojere Market" is
  already taken on the App Store, choose a variant such as "Mojere Market Ondo".
- After about 10–30 minutes of Apple processing, open **appstoreconnect.apple.com** → **Apps** →
  **Mojere Market** → **TestFlight** → add yourself under **Internal Testing**.
- On your iPhone, install **TestFlight** from the App Store, open the invitation, and install Mojere
  Market. **Test everything** in `docs/TESTING.md`.

## Step 6 — The App Store listing

In App Store Connect → your app → **App Store** tab:

| Field | What to enter |
|---|---|
| Name / Subtitle | Mojere Market / "Buy and sell in Ondo State" |
| Category | **Shopping** |
| Description, Keywords | Describe it honestly (local marketplace, safe meetups, Declutter My Home) |
| Screenshots | Screenshots from your iPhone of Home, Explore, a listing, Sell and Messages. App Store Connect shows the required sizes; use your largest iPhone screenshots |
| Support URL | Your support web page (it can be the same Google Site) |
| Privacy Policy URL | From Step 1 |
| Age rating | Answer the questionnaire honestly. It has user-generated content and messaging, with reporting and blocking |
| App Privacy | See the list below |
| Sign-in information (App Review) | The reviewer account from Step 1. Mention: "Payments are not used in the iPhone app; buyers and sellers meet in person." |

**App Privacy answers (what the app actually collects):**
- **Contact info:** email address (for the account), and name (display name).
- **Location:** coarse location only, the area/LGA people choose. The app does **not** use GPS.
- **User content:** photos, listings, messages, reviews, and support reports.
- **Identifiers:** a user ID.
- **Usage data / diagnostics:** none collected by Mojere Market.
- **Tracking:** **No.** Mojere Market does not track people across other apps or sell data.
- Everything collected is **linked to the person's account** and used for **app functionality**.

Then click **Add for Review** → **Submit**. Apple's review usually takes 1–3 days. If they reject
something, send the message to your developer.

## Releasing updates later

1. `git pull`, then run any new database part.
2. `npx.cmd eas-cli@latest build --platform ios --profile production` (the build number goes up by itself).
3. `npx.cmd eas-cli@latest submit --platform ios --latest`, then submit the new version in App Store Connect.
