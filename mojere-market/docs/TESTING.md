# Mojere Market — Testing guide

## Automated checks

Run from inside the `mojere-market` folder:

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript finds mistakes in the code without running it |
| `npm test` | Runs the automated tests in `__tests__/` |
| `npm run check` | Both of the above |

What the tests cover so far (Phase 1):

- Naira formatting and price parsing (`₦1,500`, kobo handling, rejecting bad input).
- The Supabase settings guard: missing settings are reported, and **secret /
  service-role keys are refused**.
- All 18 Ondo State LGAs, the 13 categories and 5 item conditions are present.
- Home screen: brand and setup notice show; Sell/Declutter buttons and
  category tiles navigate to the right place.
- Profile screen: the connection test is disabled until Supabase is set up.

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

Record the phone model and result for each check. Later phases add more checks here.
