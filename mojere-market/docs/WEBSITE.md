# Mojere Market — Website

The website is the same Mojere Market app, running in a web browser. One build gives you:

| Page | Address (after publishing) | Used for |
|---|---|---|
| Marketplace | `/` (Home), `/explore`, `/sell`, … | People can browse, sell and chat without installing anything |
| About | `/about` | A simple introduction to share on social media |
| Privacy Policy | `/privacy` | **Required link** for the App Store and Google Play |
| Support | `/support` | **Support URL** for the App Store |
| Delete account | `/delete-account` | **Account deletion link** that Google Play asks for |
| Terms, Community guidelines | `/terms`, `/guidelines` | |

The Privacy Policy page text is in `src/app/privacy.tsx`. Have a Nigerian lawyer review it.
When you know the legal owner (your full name or registered business), send it to your developer so it can
be added (`legalOperator` in `src/constants/brand.ts`).

## Publishing it (free hosting by Expo)

💳 EAS Hosting has a free plan with limits; check **expo.dev/pricing** before relying on it for heavy traffic.
Do these on your laptop in PowerShell. Nothing is public until step 3.

1. Get the latest code:

   ```
   cd C:\dev\Ankoo-\mojere-market
   git pull
   npm.cmd install
   ```

2. Build the website files (uses your `.env` settings; only the public key is included):

   ```
   npx.cmd expo export --platform web
   ```

   It ends with `Exported: dist`. Needs about 200 MB of free disk space.

3. Upload it:

   ```
   npx.cmd eas-cli@latest deploy
   ```

   - The first time, it asks you to choose a **name for your website address** (for example `mojere-market`).
   - It prints a **preview link**. Open it on your phone and check Home, Privacy Policy and Support.

4. When you are happy, publish the main address:

   ```
   npx.cmd eas-cli@latest deploy --prod
   ```

   Your website is now public, for example `https://mojere-market.expo.app`. Your Privacy Policy is at
   `https://mojere-market.expo.app/privacy`.

**Updating the website later:** repeat steps 1–4.

## What has been tested and what has not

- Tested on a practice copy: every page opens on a phone-sized browser without errors or sideways
  scrolling, links between pages work, and "Are you sure?" questions work in a browser.
- **Not yet tested:** signing up, uploading photos and chatting on the live website with your real
  database; and opening a link to one specific item directly (for example a shared `/listing/…` link)
  on Expo's hosting. Try these after step 3 and tell your developer if anything fails.
- Phone alerts (push notifications) are only for the installed apps, not the website.
