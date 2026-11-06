# Put Ankoo online (Railway, about $5/month)

Railway builds the app from your GitHub repo and gives it a permanent disk for customer data. You can do every step below in a web browser, including on a phone. It takes about 20 minutes.

## 1. Create the Railway project
1. Go to **railway.com**, click **Login → GitHub**, and sign in with the GitHub account that owns `phebho202-sudo/Ankoo-`.
2. Subscribe to the **Hobby plan** ($5/month, paid by card. Many Nigerian bank cards fail for dollar payments; a virtual dollar card from your bank or a fintech app usually works).
3. Click **New Project → Deploy from GitHub repo**. If asked, click **Configure GitHub App** and give Railway access to **Ankoo-**.
4. Choose **Ankoo-**. Then open the service, go to **Settings → Source → Branch**, and pick **`claude/ankoo-mvp`** (or `master` once you merge it).

Railway finds the `Dockerfile` and `railway.json` in the repo and starts building.

## 2. Add the permanent disk (do not skip)
Without this, every customer's records are wiped each time the app restarts.
1. In the project canvas, **right-click the service → Attach Volume** (or press ⌘K / Ctrl+K and type "volume").
2. Set the **mount path** to `/data`.

## 3. Get your web address
**Service → Settings → Networking → Generate Domain.** You'll get a URL like `https://ankoo-production.up.railway.app`. Copy it.

## 4. Set the variables
**Service → Variables → Raw Editor**, paste the block below and fill in your details:
```
BASE_URL=https://ankoo-production.up.railway.app
ADMIN_EMAILS=phebho202@gmail.com
SMALL_COMPANY_TURNOVER_NGN=100000000
```
Click **Deploy** when prompted. `NODE_ENV`, `DB_PATH` and `TRUST_PROXY` are already set inside the Dockerfile.

Open your URL and create an account **using the email you put in `ADMIN_EMAILS`**. You'll then see the Admin box on the Account page.

> At this point the app works, but **"Get Pro" shows "Payments are not configured"** until you finish step 5. That's deliberate: nobody can get Pro without paying.

## 5. Connect Paystack (so you get paid)
1. Sign up at **paystack.com** as a Nigerian business. You can start as a *Starter business* with your BVN and ID; register a business name with CAC later to raise your limits.
2. **Settings → API Keys & Webhooks**:
   - Copy the **Test Secret Key** (`sk_test_...`) first.
   - In **Test Webhook URL**, enter `https://YOUR-URL/webhooks/paystack`.
3. In Railway Variables, add `PAYSTACK_SECRET_KEY=sk_test_...` and redeploy.
4. Test it: in the app, go to **Account → Get Pro Monthly** and pay with Paystack's test card (`4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`). You should come back as **⭐ Pro**.
5. When Paystack activates your account for live payments, swap in the **Live Secret Key** (`sk_live_...`), set the **Live Webhook URL** to the same address, and redeploy. Real money now goes to your bank account.

## 6. Use your own domain (optional, about ₦5,000–₦25,000/year)
Buy a domain such as `ankoo.com.ng` from a Nigerian registrar. Then go to **Railway → Settings → Networking → Custom Domain**, add the CNAME record it shows at your registrar, and change `BASE_URL` to the new domain. If Paystack is set up, update the webhook URL too.

## 7. Backups (weekly at minimum)
Railway volumes can be backed up from the volume's **Backups** tab, if your plan offers it. Turn on scheduled backups. These are your customers' business records.

## If something goes wrong
- **Build fails:** open the deployment's **Build Logs** and send me the last 30 lines.
- **App shows "Application failed to respond":** check that the deploy logs say `Ankoo running on ...`, and that the volume is mounted at `/data`.
- **Payment made but no Pro:** check that the Paystack webhook URL is exactly `https://YOUR-URL/webhooks/paystack` and that the key mode (test or live) matches the webhook you set.
