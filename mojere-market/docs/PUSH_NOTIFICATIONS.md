# Mojere Market — Push notifications (lock-screen alerts)

**Status:** built, but they only work in an **installed build** (not Expo Go). Inside the app, notifications
already work everywhere (bell on Home, Notifications screen).

## How it works

1. In an installed build, after login the app asks permission and registers the phone (`push_tokens` table).
2. Whenever an in-app notification is created (new message, offer, etc.), a Supabase **Database Webhook**
   calls the `send-push` server function.
3. `send-push` checks a shared secret, respects the user's **Phone alerts** setting, sends the alert through
   Expo's free push service, and removes phones that uninstalled the app.
4. Tapping the alert opens the right chat or item.

## Setup (after you have an installed build — see ANDROID_BUILD.md / IOS_BUILD.md)

1. Make sure `eas init` has been run and the **project ID** is saved in `app.json` (push needs it).
2. **iPhone only:** EAS sets up Apple push keys during `eas build` (answer **Yes**). **Android:** follow EAS's
   prompt to add Firebase Cloud Messaging credentials (`npx.cmd eas-cli@latest credentials`) — free.
3. Choose a long random secret (e.g. 40 random letters and numbers). In **Supabase → Edge Functions → Secrets**,
   add `PUSH_WEBHOOK_SECRET` with that value.
4. Deploy the function:

   ```
   npx.cmd supabase functions deploy send-push --no-verify-jwt
   ```

5. In **Supabase → Database → Webhooks** → **Create a new hook**:
   - Table: `notifications`, Events: **Insert**
   - Type: **Supabase Edge Functions** → `send-push`, Method: **POST**
   - Add an HTTP header: `x-webhook-secret` = the same secret as step 3
6. Test: log in on the installed app, allow notifications, then from another account send yourself a
   message. A lock-screen alert should arrive within seconds.

To switch alerts off for everyone, disable the webhook. Each user can turn alerts off in
**Profile → Notification settings → Phone alerts**.
