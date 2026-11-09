# Mojere Market — iPhone (iOS) build guide

**Important cost note:** Apple only lets apps be installed on iPhones (outside Expo Go) through an
**Apple Developer Program** membership, which costs about **US$99 per year**. Do not enrol until you have
decided to; nothing in Mojere Market requires it for testing.

**Until then:** keep testing on your iPhone with **Expo Go** (free), exactly as you do now. Everything works
there except lock-screen push alerts.

You do **not** need a Mac: EAS builds iPhone apps in the cloud.

## When you are ready (after enrolling in the Apple Developer Program)

1. Complete the one-time setup in `docs/ANDROID_BUILD.md` (login, `init`, environment values) if not done.
   Add the environment values for `production` too.
2. Make an iPhone build:

   ```
   npx.cmd eas-cli@latest build --platform ios --profile production
   ```

   EAS asks you to sign in with your **Apple ID** and creates the certificates for you. Answer **Yes** to
   its questions. Your Apple password goes only to Apple/EAS, never into the code or chat.
3. Send the build to **TestFlight** (Apple's free testing app):

   ```
   npx.cmd eas-cli@latest submit --platform ios --latest
   ```

4. In **App Store Connect** (appstoreconnect.apple.com) → your app → **TestFlight**, add yourself as a tester.
   Install **TestFlight** from the App Store on your iPhone and install Mojere Market from there.

**What you should see:** the Mojere Market icon on your iPhone, opening without Expo Go, and lock-screen
alerts once push notifications are set up (`docs/PUSH_NOTIFICATIONS.md`).

## Publishing on the App Store — only when you decide

Needs a store listing (description, screenshots, age rating), a **privacy policy web address**, privacy
"nutrition label" answers, and Apple's review. See `docs/DEPLOYMENT_CHECKLIST.md`.

The app already declares it uses only standard encryption (so you are not asked about export rules each
build) and explains why it needs the camera and photos.
