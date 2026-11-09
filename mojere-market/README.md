# Mojere Market

**Turn unused into useful.** · *Buy Local. Sell Local. Live Better.*

Mojere Market is a peer-to-peer buying, selling and decluttering marketplace for
Ondo State, Nigeria, launching first in Akure and the FUTA community. It is one
app for Android and iPhone, built with React Native and Expo, with Supabase for
accounts, the database, photo storage and realtime chat.

> Somebody’s clutter is somebody else’s treasure.

## Status

The app is built in phases. Each phase is checked before the next one starts.

| Phase | What it covers | Status |
|---|---|---|
| 1 | Project setup, navigation, brand, structure, tests | **Done** |
| 2 | Connect your existing Supabase project, database tables, security rules, seed data | **Done.** Live in the Supabase project |
| 3 | Sign-up, login, password reset, profiles, location | **Done.** Tested on iPhone with the real project |
| 4 | Home feed, categories, search, filters, product page | **Done.** Tested on iPhone |
| 5 | Selling, photo uploads, Declutter My Home | **Built and tested.** Needs a full phone test with real photos |
| 6 | Favourites, offers, realtime messages, notifications | **Built and tested.** Needs a two-account test on the phone |
| 7 | Business storefronts, promotions, payment preparation | **Built and tested** (automated + practice database). Payments **switched off** until you decide ([docs/PAYMENTS.md](docs/PAYMENTS.md)). Needs the Part J database update |
| 8 | Reporting, blocking, moderation, admin dashboard | Next |
| 9 | Full testing and Android/iOS build preparation | Not started |

Screens that need the database show a clear "not connected yet" notice instead
of pretending to work.

## Run it

Step-by-step instructions for beginners: **[docs/BEGINNER_SETUP.md](docs/BEGINNER_SETUP.md)**.

Short version (from inside this `mojere-market` folder):

```bash
npm install          # download the app's building blocks (first time only)
cp .env.example .env # then fill in your Supabase URL and public key
npm start            # start the app; scan the QR code with Expo Go
npm run check        # TypeScript check + automated tests
```

## Technology

- React Native + Expo SDK 58, TypeScript (strict mode)
- Expo Router for screens and the bottom tab bar
- Supabase (auth, PostgreSQL, storage, realtime) via `@supabase/supabase-js`
- TanStack Query for loading and caching server data
- React Hook Form + Zod for forms and validation
- Jest + React Native Testing Library for tests

## Project layout

```
src/app/            Screens. Every file here is a screen (Expo Router).
  _layout.tsx       App-wide setup (data cache, login state, safe areas)
  (tabs)/           The five bottom tabs: Home, Explore, Sell, Messages, Profile
  auth/             Welcome, sign-up, log-in, email code, password reset
  listing/[id].tsx  Product page: photos, price, details, seller, safety tips, save, report
  seller/[id].tsx   A seller's public page and their items
  listing-editor.tsx Sell or edit an item: photos, details, preview, publish or draft
  my-listings.tsx   Edit, pause, mark sold, delete; view counts
  declutter/        Declutter My Home sessions and their items
  chat/[id].tsx     Live chat with item context, offers, handover, reviews, block/report
  notifications.tsx In-app notifications (plus notification-settings.tsx)
  favourites.tsx    Saved items
  business/         Mojere Market Business: manage business and plan; public storefronts
  promote/[id].tsx  Promote a listing (featured / homepage packages)
supabase/functions  Server functions for Paystack (initialize + signed webhook)
  edit-profile.tsx  Edit name, LGA, town, area and bio
  terms.tsx         Terms and Privacy (draft, pending legal review)
src/components/     Reusable pieces: logo, buttons, cards, notices
src/constants/      Brand text, Ondo State LGAs, categories, item conditions
src/lib/            Supabase connection, money formatting
src/theme/          Colours, spacing and text sizes
__tests__/          Automated tests
testing/            Shared helpers for the automated tests
supabase/migrations Database changes (with matching .down.sql undo files)
supabase/inspect    Read-only check to run on your project first
supabase/tests      Security tests that run on a practice database
assets/             App icon and splash screen (temporary logo, replaceable)
docs/               Guides
```

## Security rules this project follows

- Only the **public** Supabase key ever goes in the app. The app refuses to
  start if a secret/service-role key is pasted in by mistake.
- `.env` is never committed to Git.
- Every database table has Row Level Security, checked by 137 automated database tests.
- Admin roles can only be granted from the Supabase dashboard, never from the app.
- Payments are never marked as paid from the phone: only the server, after Paystack confirms with a
  verified signature, and each payment is processed once. Prices come from the database.

## Note on this repository

This repository also contains an older, separate project in the folder above
this one. It is left untouched. Mojere Market lives entirely in this
`mojere-market/` folder.
