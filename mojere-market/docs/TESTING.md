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

- Marketplace: search parameters, "time ago" wording, Explore results, search-as-you-type,
  category links, empty states, product page details, safety advice, and log-in prompts for
  saving and reporting.

- Selling: the listing form rules (title, category, condition, price up to ₦100,000,000, free
  items), publishing needs a photo (drafts do not), saving runs draft → photos → publish, a
  failed photo save never publishes, removed photos are deleted, and Declutter only offers
  complete drafts for publishing.

- Messaging and offers: inbox with unread markers, opening chats, sending messages, making,
  countering, accepting and withdrawing offers, two-sided handover confirmation, reviews only
  after both confirm, blocking, and product-page "Message seller" / "Make an offer".

- Payments: genuine Paystack signatures accepted, forged or tampered ones rejected, prices sent by
  the app ignored, only `charge.success` events processed; Promote screen shows database prices and
  is honest that payments are off; business form and WhatsApp number helpers.

- Admin: non-staff refused, statistics shown, moderators do not see admin-only sections, a reason is
  required before removing a listing, community guidelines.
- Push notifications: webhook payload parsing, one message per real device, removing uninstalled devices,
  tapping an alert opens the right chat or item.

## Database security tests

`supabase/tests/run.sh` builds a throwaway practice PostgreSQL database, applies the Mojere Market
migrations to it, and plays four people (a seller, a buyer, someone misbehaving and an admin).
It then runs 28 marketplace checks (search by word and part of a word, filters, sorting,
pagination, featured items, hidden drafts/paused/rejected items, private view counts).
The 53 security checks confirm, for example, that users cannot make themselves admin, edit other people's listings,
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

## Manual checks for the marketplace (Phase 4)

These need at least one real listing, which becomes possible in Phase 5 (selling). Until then:
1. Home shows "No listings yet" under **Recently added**, without errors.
2. Explore: type a word in the search box; you should see "No matching items" and a **Clear** button.
3. Explore: open the filter button, set a max price lower than the min price; you should see a clear message.
4. Pull down on Home or Explore to refresh, with no errors.

## Manual checks for selling (Phase 5)

1. **Sell** tab → **Sell an item**. Tap **Preview and publish** with everything empty: clear messages appear.
2. Add 2–3 photos (**Choose photos** and **Take photo**). The phone asks for permission the first time.
   Tap the second photo: it becomes the **Cover**. Tap **✕** on one to remove it.
3. Fill in title, category, condition, price (the ₦ amount appears under the box), description.
   Location is already filled from your profile.
4. **Preview and publish** → check the preview → **Publish now**. Watch "Uploading photo 1 of 3…".
   You land on the product page with your photos.
5. Home → **Recently added** and Explore both show the item. Search for a word from its title.
6. **Sell → My listings**: try **Pause** (it disappears from Explore), **Show again**, **Edit**
   (change the price), **Mark as sold**, and **Delete** on a test item.
7. **Declutter My Home** → start a session → **Add an item** twice (use **Save and add another**),
   one without a photo. The session shows "Needs at least one photo" for that one.
   Select the complete one → **Publish 1 selected**. Counts update (Drafts / Available).
8. Try selling on mobile data instead of Wi-Fi: uploads should still work, just a little slower.

## Manual checks for messaging and offers (Phase 6) — needs two accounts

Use two phones (Android + iPhone), or one phone and log out/in between steps. Account A sells,
account B buys. Remember: on Supabase's test email limits, both emails must belong to your Supabase team,
or use the Gmail sender set up in Part D.
1. A publishes an item. B opens it → **Message seller** → sends "Is it available?".
2. A sees a badge on **Messages** and a bell count on **Home**. A opens the chat: the message is there.
   A replies; with both chats open, the reply appears on B's phone within a few seconds.
3. B → **Make offer** (e.g. ₦20,000 with a note). A gets a notification → opens it → lands in the chat.
4. A → **Counter** ₦22,000. B → **Accept**. The item shows **Reserved**.
5. B → **I received the item**; A → **I handed over the item and was paid**. The item shows **Sold**.
6. Both → **Review the …** with stars and a comment. The seller page shows the rating.
7. B saves another item (**Save item**) → Profile → **Saved items** shows it.
8. A → ⋮ → **Block this person**. B can no longer send messages. A → ⋮ → **Unblock**.
9. Profile → **Notification settings** → turn off Messages; new messages no longer create notifications.

## Manual checks for businesses and promotions (Phase 7)

1. Profile → **Mojere Market Business** → fill in the form (add a logo) → **Create my business**.
   You are on **Business Free**.
2. **View storefront**: logo, description, Call/WhatsApp buttons (only for details you entered).
3. Sell a new item: the **List under my business** switch is on. Publish it; it appears on the storefront.
4. **My listings** → **Promote** on a live item → choose a package → **Request promotion**: the app says
   online payment is not switched on yet. The request appears as "Waiting for payment".
5. Business → **Request this plan** on Business Basic: shows "Waiting for payment".
6. Payments in Paystack **test mode** are tested later, following `docs/PAYMENTS.md` Part 1.

## Manual checks for the admin dashboard (Phase 8)

1. Profile → **Admin dashboard** (only visible to staff). Statistics load.
2. From a second account, report a listing. As admin: **Reports** → **Investigate** → **Remove listing**
   (a reason is required) → **Resolve**. The listing disappears from Explore.
3. **Listings** → **Removed** → **Restore (as paused)**.
4. **Users** → search your second account → **Suspend** → that account cannot post or message → **Reactivate**.
5. **Promotions, plans and payments** → activate your "Waiting for payment" promotion (only after confirming
   payment) → the item shows **Featured** on Home.
6. **Categories, places and settings** → add a safe meetup spot in Akure South → it appears on items there.
7. **Audit log** shows every step above with your reasons.

## Final checks (Phase 9)

- Turn on airplane mode: an "You are offline" banner appears; turn it off: screens refresh by themselves.
- Run through every section above on **mobile data**, on both an Android phone and an iPhone if possible.
- Installed builds only: allow notifications and confirm a lock-screen alert for a new message
  (`docs/PUSH_NOTIFICATIONS.md`).

Record the phone model and result for each check.
