# Mojere Market — Connecting your existing Supabase project

This connects the app to the Supabase project you already have. **We do not
create a new project, and nothing existing is deleted or changed.**

Do the parts in order, one at a time. Each part says what you should see.
If anything looks different, take a screenshot and share it.

**Words you will meet**

- **Supabase dashboard**: the website at supabase.com where your project lives.
- **SQL Editor**: a page in the dashboard where you paste database instructions and press *Run*.
- **Migration**: a file of database instructions that adds Mojere Market's tables.
- **Anon / publishable key**: a *public* key that is safe to put in the app. Your data is protected by security rules, not by hiding this key.
- **Service-role / secret key**: a *private* master key. It must **never** go in the app, in chat, or in GitHub.

---

## Part A — Read-only check of your project (changes nothing)

This shows what already exists, so we can be sure Mojere Market won't clash with your earlier work.

1. Open **supabase.com** and sign in. Click your **existing project**.
2. In the left menu, click **SQL Editor**.
3. Click **+ New query** (or the **+** tab).
4. On your laptop, open the file
   `C:\dev\Ankoo-\mojere-market\supabase\inspect\00_readonly_inspection.sql`
   (right-click it → **Open with** → **Notepad**).
5. Press **Ctrl + A** then **Ctrl + C** to copy everything.
6. Click into the big box in the SQL Editor, press **Ctrl + V** to paste, then click **Run** (bottom right).

**What you should see:** a table with three columns: `section`, `name`, `details`.

7. **Share the result**: either click **Export → Download CSV** and send the file, or take screenshots
   (scroll down to capture every row).

➡️ **Stop here and wait** until the result has been reviewed. If any row says
**"NAME CLASH with Mojere Market"**, the migration must be adapted first.

---

## Part B — Create Mojere Market's tables (after Part A is reviewed)

1. In **SQL Editor**, click **+ New query**.
2. Open `C:\dev\Ankoo-\mojere-market\supabase\migrations\20261108000100_mojere_market_core.sql`
   in Notepad, copy everything, paste it into the SQL Editor, and click **Run**.
3. If Supabase shows a warning about "destructive operations", read it. This file does not delete anything, but
   if the warning mentions dropping or deleting, **stop and share a screenshot** instead of confirming.

**What you should see:** `Success. No rows returned`.
**If you see an error starting with "Mojere Market migration stopped, nothing was changed"**: nothing was
changed. Share a screenshot.

4. Check it worked: in the left menu click **Table Editor**. You should see new tables such as
   `listings`, `user_profiles`, `categories` and `locations`. Click **locations**: it should have 36 rows
   (18 LGAs and their 18 main towns).

## Part C — Create the photo storage

1. **SQL Editor** → **+ New query**.
2. Open `supabase\migrations\20261108000200_mojere_market_storage.sql`, copy, paste, click **Run**.

**What you should see:** `Success. No rows returned`. In the left menu, **Storage** now shows
`listing-images`, `profile-images` and `business-images`.

**If you see "must be owner of table objects"**, share a screenshot. It means your project needs the
storage rules added through the dashboard instead; nothing was changed.

## Part D — Email sending and sign-up codes

Mojere Market confirms emails with a **6-digit code** the user types into the app. Supabase only lets you
change the email wording once the project sends email through its own email service (SMTP). We use a
free Gmail **app password** for this.

**D1. Create a Gmail app password**
1. Make sure **2-Step Verification** is on at **myaccount.google.com/security**.
2. Go to **myaccount.google.com/apppasswords**, type `Mojere Market Supabase` as the app name, click **Create**.
3. Keep the yellow box with the 16-letter password open. Never share it.

**D2. Connect Gmail in Supabase**: **Authentication → Emails → SMTP Settings** (or the **Set up SMTP** button)
- Enable Custom SMTP: **on**
- Sender email and Username: your Gmail address (both the same)
- Sender name: `Mojere Market`
- Host: `smtp.gmail.com`, Port: `465`
- Password: the 16 letters, **typed without spaces**. Then click **Save**.

If sign-up says "Error sending confirmation email", open **Logs → Auth**. The message
`535 Username and Password not accepted` means the app password is wrong: create a new one and type it again.

**D3. Email provider settings**: **Authentication → Sign In / Providers → Email**
- **Enable Email provider**: on. **Confirm email**: on.
- **Email OTP Length**: 6. **Email OTP Expiration**: 3600. Click **Save**.

**D4. Templates**: **Authentication → Emails**
1. Click **Confirm sign up**. Above the body, switch from **Preview** to **Source**.
2. Click inside the code box, press **Ctrl + A**, then **Delete**, so the box is completely empty
   (otherwise the new text is added after the old link).
3. Paste:

   ```html
   <h2>Welcome to Mojere Market</h2>
   <p>Your confirmation code is:</p>
   <h1>{{ .Token }}</h1>
   <p>Type this code in the Mojere Market app. Never share it with anyone.</p>
   ```

   Click **Save changes**, then check **Preview** shows only this text.
4. Do the same for **Reset password** with:

   ```html
   <h2>Reset your Mojere Market password</h2>
   <p>Your reset code is:</p>
   <h1>{{ .Token }}</h1>
   <p>If you did not ask to reset your password, ignore this email.</p>
   ```

**Tip:** each time a new code is sent, the previous code stops working. Gmail groups these emails into one
conversation, so always use the code in the **last** message.

## Part E — Put the two public settings into the app

1. Left menu → **Project Settings** (gear icon) → **API** (sometimes called **Data API** or **API Keys**).
2. Find the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Find the **anon public** key, or the **publishable** key (starts with `eyJ...` or `sb_publishable_`).
   **Do not use** the `service_role` or `secret` key.
4. On the laptop, in PowerShell inside `C:\dev\Ankoo-\mojere-market`, copy the public key, then run
   (replace the URL with your own Project URL):

   ```
   $key = Read-Host "Paste the public key"
   Set-Content -Path .env -Encoding ascii -Value @("EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co", "EXPO_PUBLIC_SUPABASE_ANON_KEY=$($key.Trim())")
   Select-String -Path .env -Pattern "EXPO_PUBLIC"
   ```

   The last command must show a value after both `=` signs. The `.env` file stays on your laptop and is
   never uploaded to GitHub.

5. Restart the app: in PowerShell press **Ctrl + C**, then run `npx.cmd expo start --tunnel --clear`.
   Settings are only read when the app starts.

**What you should see:** the yellow "Not connected to the database yet" box is gone. On the **Profile** tab,
tap **Test Supabase connection** and you should see **Success**.

## Part F — Create your account and make yourself the admin

1. In the app: **Profile** → **Create an account**, using the email you use for Supabase.
2. Enter the 6-digit code from your email, then fill in your profile.
3. In Supabase → **SQL Editor** → **+ New query**, paste this, **replacing the email** with yours, and click **Run**:

   ```sql
   insert into public.user_roles (user_id, role, note)
   select id, 'admin', 'Founder'
   from auth.users
   where email = 'your-email@example.com';
   ```

**What you should see:** `Success. 1 row affected` (or `INSERT 0 1`).

Admin rights can only be given this way, from the Supabase dashboard. Nobody can make themselves an
admin from inside the app.

## Part G — Marketplace browsing functions (Phase 4)

This adds the server functions that power search, filters and the product page. It **only adds
functions**: no tables or data are changed.

1. **SQL Editor** → **+** (new empty tab).
2. In PowerShell inside `C:\dev\Ankoo-\mojere-market`, run
   `notepad supabase\migrations\20261109000100_mojere_market_marketplace.sql`,
   then **Ctrl + A**, **Ctrl + C**.
3. Paste into Supabase and click **Run**.

**What you should see:** `Success. No rows returned`.

## Part H — Selling support (Phase 5)

Adds one storage rule so users can look up (and therefore delete) **their own** photo files.
Without it, deleted listings would leave their photos behind in storage.

1. **SQL Editor** → **+** (new empty tab).
2. In PowerShell: `notepad supabase\migrations\20261110000100_mojere_market_selling.sql`,
   then **Ctrl + A**, **Ctrl + C**.
3. Paste into Supabase and click **Run**.

**What you should see:** `Success. No rows returned`.

## Undoing (only if ever needed)

The `.down.sql` files in `supabase/migrations` reverse each step. Undoing the core migration
**deletes all Mojere Market data**, so only use it before launch, and ask first.
