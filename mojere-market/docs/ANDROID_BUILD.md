# Mojere Market — Android build guide

Builds are made in the cloud by **EAS** (Expo Application Services), so you do not need Android Studio.
Do these steps on your laptop in PowerShell, inside `C:\dev\Ankoo-\mojere-market`.

**Costs:** an Expo account is free and includes a limited number of free cloud builds each month (check
current limits at expo.dev/pricing). Installing an APK on phones is free. Publishing on Google Play needs a
**one-time Google Play developer fee** — only do that with your approval.

## One-time setup

1. **Link the project to your Expo account** (the same account you use in Expo Go):

   ```
   npx.cmd eas-cli@latest login
   npx.cmd eas-cli@latest init
   ```

   `init` asks to create a project — answer **Yes**. It adds a **project ID** to `app.json`.
   **Send the project ID to your developer** (it is not secret) so it can be saved in the code; otherwise your
   next `git pull` may stop with "Aborting". Push notifications also need this ID.

2. **Give the cloud builds your public settings.** Your `.env` file never leaves your laptop, so EAS needs its
   own copy. Run each line, replacing the values (these two are public values, not secrets):

   ```
   npx.cmd eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://xhawmbiehhimusjyqtbw.supabase.co --visibility plaintext
   npx.cmd eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value PASTE_PUBLIC_KEY --visibility plaintext
   npx.cmd eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_PAYMENTS_ENABLED --value false --visibility plaintext
   ```

   Repeat with `--environment production` before making a production build.
   **Never** add the service-role/secret key or the Paystack secret key here.

## Test build (APK you can install directly)

```
npx.cmd eas-cli@latest build --platform android --profile preview
```

- It asks to create an Android signing key: answer **Yes** (EAS keeps it safe; do not lose access to your Expo account).
- The build runs in the cloud (about 10–30 minutes). At the end you get a **link and QR code**.
- On an Android phone, open the link, download the `.apk`, and allow "install from this source" when asked.

**What you should see:** a real **Mojere Market** app icon on the phone, opening without Expo Go.

## Production build (for Google Play) — only when you decide to publish

```
npx.cmd eas-cli@latest build --platform android --profile production
```

This makes an `.aab` file for Google Play. Uploading it needs a Google Play Console account (one-time fee),
a store listing (description, screenshots), a **privacy policy web address**, and Google's review.
See `docs/DEPLOYMENT_CHECKLIST.md` first.

## Updating the version

The build number goes up automatically for production builds. Change `"version"` in `app.json`
(e.g. `0.1.0` → `0.2.0`) for each public release.
