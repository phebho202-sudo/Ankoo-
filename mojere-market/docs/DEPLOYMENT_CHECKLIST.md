# Mojere Market — Launch checklist

Nothing here happens automatically. Tick each item yourself. Items marked 💳 cost money and need your decision.

## 1. Database (Supabase)
- [ ] All migrations in `supabase/migrations` have been run, in date order (Parts B–M of `SUPABASE_SETUP.md`).
- [ ] Your account is an **admin** (`docs/ADMIN_SETUP.md`); any moderators added.
- [ ] Decide on listing review: Admin → Categories and settings → "New listings need approval".
- [ ] Add a few **safe meetup spots** in Akure South and Akure North (busy public places you know).
- [ ] 💳 Consider Supabase **Pro**: free projects pause after a period of inactivity and have limited backups.
      For real users, daily backups and no pausing matter.
- [ ] Check **Authentication → Rate Limits** are reasonable (protects against spam sign-ups).

## 2. Email
- [ ] Sign-up and password-reset codes arrive (Gmail sender works).
- [ ] 💳 Before growing beyond a few hundred users: move to a proper email service with your own domain
      (e.g. `hello@mojeremarket.ng`), since Gmail limits daily sending and looks less official.

## 3. Legal and trust
- [ ] Have a **Nigerian lawyer** review the Terms and Privacy text (`src/app/terms.tsx`), including the
      **Nigeria Data Protection Act 2023** requirements, and update the app.
- [ ] Publish the Privacy Policy on a **public web page** (both app stores require a link).
- [ ] Set up a support email address and send it to your developer to show in the app (Apple and Google require a contact).
- [ ] Try **Profile → Delete my account** with a test account (required by Apple and Google).
- [ ] Read the community guidelines (`src/app/guidelines.tsx`) and adjust the prohibited-items list.

## 4. Payments (optional at launch)
- [ ] Payments stay **off** unless you decide otherwise (`EXPO_PUBLIC_PAYMENTS_ENABLED=false`).
- [ ] If turning on: complete **test mode** end to end (`docs/PAYMENTS.md` Part 1), then 💳 Paystack business
      verification and the live key (Part 2). Make one small real payment yourself first.

## 5. Builds and stores
- [ ] `eas init` done; project ID saved in `app.json`; EAS environment values set for `production`.
- [ ] Android test APK installed and checked (`docs/ANDROID_BUILD.md`).
- [ ] 💳 Google Play Console account (one-time fee) → production build → store listing → review.
- [ ] 💳 Apple Developer Program (yearly fee) → TestFlight → App Store listing → review (`docs/IOS_BUILD.md`).
- [ ] Push notifications set up and tested on an installed build (`docs/PUSH_NOTIFICATIONS.md`).
- [ ] Replace the temporary logo and app icon with final artwork (`assets/` and `src/components/logo.tsx`).

## 6. Final testing (on real phones, on mobile data as well as Wi-Fi)
- [ ] Every manual check in `docs/TESTING.md`, on one Android and one iPhone.
- [ ] Two accounts: message, offer, counteroffer, accept, both confirm handover, review.
- [ ] Report a listing and a message; resolve them in the admin dashboard; check the audit log.
- [ ] Turn on airplane mode: the offline banner appears; turn it off: screens refresh.

## 7. Launch in Akure / FUTA (full plan: `docs/LAUNCH_PLAN.md`)
- [ ] Seed real listings by inviting real sellers (never fake listings or reviews).
- [ ] Watch Admin → Reports daily for the first weeks.
- [ ] Keep `git pull` + migrations + `eas build` as the update routine; note each release in a simple log.
