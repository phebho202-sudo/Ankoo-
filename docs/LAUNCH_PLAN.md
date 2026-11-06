# Ankoo launch plan: from ₦0 to income

## How money comes in
| Stream | Price | Who pays |
|---|---|---|
| **Pro Monthly** | ₦1,500 | Traders who need unlimited records, the tax report and CSV |
| **Pro Yearly** | ₦15,000 (2 months free) | Traders who want a year of cover for the tax year |
| *Later:* accountant referrals | ₦2,000–₦5,000 per filed return | Pro users who want a professional to file |

Payments go through **Paystack** straight into your bank account. Agents earn **20%** of every payment from traders they referred, for those traders' first 12 months. You pay agents by bank transfer from the Admin panel.

## Unit economics (per Pro Monthly user)
- Revenue ₦1,500 − Paystack fee about ₦22 (1.5%) − agent commission ₦300 = **about ₦1,178 net**
- Hosting: about $5/month (~₦8,000) covers thousands of users

| Paying users | Net monthly income (approx.) |
|---|---|
| 50 | ₦59,000 |
| 300 | ₦353,000 |
| 1,000 | ₦1.18m |
| 5,000 | ₦5.9m |

These are targets, not forecasts. Real conversion from free to Pro is unknown until you test it.

## Startup costs (under $50)
- Domain (.com.ng or .ng): about ₦5,000–₦25,000 a year, optional at first
- VPS or hosting with a persistent disk: about $5/month (see README)
- Paystack account: free. Register as a business name with CAC when you can; Paystack needs it for full limits.
- Flyers for the first market: about ₦10,000

## 30-day launch plan
**Week 1: get it live**
1. Deploy (README → Deploy). Set `ADMIN_EMAILS` to your email.
2. Create a Paystack account, copy the **secret key** into `PAYSTACK_SECRET_KEY`, and set the webhook URL to `https://YOURDOMAIN/webhooks/paystack`.
3. Make a ₦1,500 test payment yourself and check that Pro turns on.
4. Confirm the small-company turnover limit (₦50m vs ₦100m) and set `SMALL_COMPANY_TURNOVER_NGN`.

**Week 2: the first 50 traders (you, in person)**
- Go to one market (provisions, fabrics, phone accessories). Install Ankoo on traders' phones ("Add to Home screen") and record their first sale with them.
- Your pitch: *"From this year, the law says every business must keep records for 6 years. Ankoo keeps them on your phone and shows you if you pay ₦0 tax. Free to start."*
- Ask: what confuses you? What would make you pay?

**Week 3: recruit 5–10 agents**
- Recruit unemployed graduates, NYSC members and market youth leaders. Each one gets their own referral link from the Account page.
- Give them a script and flyers. They earn ₦300 per monthly payment, or ₦3,000 per yearly payment, for each trader's first year.

**Week 4: convert**
- Send WhatsApp broadcasts to free users: "Download your Tax Readiness Report before filing season."
- Push the yearly plan around tax-filing deadlines.
- Watch Admin: total users, Pro users, 30-day revenue.

## Growth ideas once it works
- Partner with trade associations, market unions, cooperatives and SMEDAN programmes for bulk sign-ups.
- Add a Hausa / Yoruba / Igbo / Pidgin interface.
- Turn a trader's records into a credit history for microfinance banks, who will pay for qualified leads.
- Add a WhatsApp bot so traders can record a sale by typing "sold rice 25000".

## Risks
- **Tax-rule accuracy:** keep the "estimate, not advice" wording, and update thresholds when official guidance comes out.
- **Competition** from Moniepoint, Bumpa and others: compete on price, offline use, the tax-report angle and in-person agents.
- **Data:** back up the SQLite file every day (see README). It holds customers' business records.
- **Nigeria Data Protection Act 2023:** publish a privacy policy and never sell trader data without consent.
