# Mojere Market — Testing guide

## Automated checks

Run from inside the `mojere-market` folder:

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript finds mistakes in the code without running it |
| `npm test` | Runs the automated tests in `__tests__/` |
| `npm run lint` | Looks for common coding mistakes |
| `npm run check` | All three of the above |

What the app tests cover:

- Naira formatting and price parsing (`₦1,500`, kobo handling, rejecting bad input).
- The Supabase settings guard: missing settings are reported, and **secret /
  service-role keys are refused**.
- All 18 Ondo State LGAs, the 13 categories and 5 item conditions are present.
- Home screen: brand and setup notice show; Sell/Declutter buttons and
  category tiles navigate to the right place.
- Profile screen: the connection test and sign-up are disabled until Supabase is set up.
- Sign-up, log-in, email code and password reset: forms reject bad input in plain language, send
  the right request to Supabase, and handle wrong passwords, unconfirmed emails and taken emails.

## Database security tests

`supabase/tests/run.sh` builds a throwaway practice PostgreSQL database, applies the Mojere Market
migrations to it, and plays four people (a seller, a buyer, someone misbehaving and an admin).
53 checks confirm, for example, that users cannot make themselves admin, edit other people's listings,
read other people's messages, mark payments as paid, activate promotions without paying, review
people they never traded with, or upload photos into someone else's folder. It also checks that
the migration refuses to run if a table name already exists, and that it leaves existing tables,
data and functions untouched. This runs on a developer machine with PostgreSQL installed, never on
your real project.

## Manual phone checks (Phase 1)

Use Expo Go on both an Android phone and an iPhone (see BEGINNER_SETUP.md).

1. The app opens on **Home** with the Mojere Market logo.
2. Tap each of the five bottom tabs: Home, Explore, Sell, Messages, Profile.
   Each opens its own screen.
3. On Home, tap **Furniture**. Explore opens with a green **Furniture** chip.
   Tap the small ✕ on the chip; it disappears.
4. On Home, tap **Sell an Item**, then go back to Home and tap
   **Declutter My Home**. Both open the Sell tab.
5. On Profile, **Test Supabase connection** is greyed out until Phase 2.
6. Turn the phone's text size up in system settings. Text should grow but
   stay readable and not overlap.

## Manual checks after connecting Supabase (Phase 3)

1. Profile → **Create an account** with the email you use for Supabase. Try leaving fields empty
   first: each should show a clear message.
2. An email with a 6-digit code arrives (check spam). Enter it. You land on **Edit profile**.
3. Choose your LGA and town, save. Profile shows your name, area and "Email verified".
4. **Log out**, then **Log in** with a wrong password (clear message), then the right one.
5. **Forgot your password?** → code by email → set a new password → log in with it.
6. Close the app completely and reopen it: you should still be logged in.

Record the phone model and result for each check.
