# Mojere Market — Admin guide

## Who can do what

| Role | Can | Cannot |
|---|---|---|
| **Admin** | Everything below, plus suspend/reactivate accounts, activate or stop promotions, edit prices, manage categories, towns, safe meetup spots and settings | Edit or delete the audit log |
| **Moderator** | See statistics, review reports, approve/reject/remove/restore listings, see the user list | Suspend accounts, change prices, activate promotions, change settings |
| Everyone else | Nothing in the admin area | — |

Roles can **only** be given from the Supabase dashboard. Nobody can make themselves an admin from the app.
Every sensitive action is written to the **audit log**, with the reason you give.

## Giving someone a role

Supabase → **SQL Editor** → **+** → paste, change the email and role, **Run**:

```sql
insert into public.user_roles (user_id, role, note)
select id, 'moderator', 'Helps with reports'   -- or 'admin'
from auth.users where email = 'person@example.com';
```

Removing a role:

```sql
delete from public.user_roles
where user_id = (select id from auth.users where email = 'person@example.com');
```

The person may need to close and reopen the app to see (or stop seeing) the **Admin dashboard** button.

## Opening the dashboard

Profile → **Admin dashboard** (only visible to staff).

- **Statistics**: users, live listings, items waiting for review, open reports, sales confirmed by both
  sides, businesses, promotions, and **verified** revenue (only payments Paystack confirmed).
- **Reports**: oldest first. Tap **Investigate** to see the listing, the reported message (opening a
  message is itself logged), the person, and how many other reports exist about the same target. Then
  **Remove listing**, **Suspend** (admins), **Resolve** or **Dismiss**. A reason is always required.
- **Listings**: *Waiting for review*, *Live*, *Rejected*, *Removed*. **Reject** lets the seller fix and
  resubmit; **Remove** takes it down for good (the seller cannot edit it); **Restore** brings it back paused.
- **Users**: search by name or email; see live listings and open reports; **Suspend** / **Reactivate**.
  Suspended users cannot post listings or send messages, and are told their account was suspended.
- **Promotions, plans and payments** (admins):
  - *Promotions*: **Activate (paid)** only after you have personally confirmed the money arrived (for
    example a bank transfer). Paystack payments activate automatically. **Stop** or **Mark refunded**
    (make the actual refund in Paystack first).
  - *Prices*: edit promotion and plan prices. New prices apply to new requests only.
  - *Payments*: every payment record and its status.
- **Categories, places and settings** (admins): add or hide categories; add towns/areas inside the 18
  LGAs; add **safe meetup spots** (shown on item pages in that LGA — only add busy, public places you
  know are suitable); switch **"New listings need approval"** on or off.
- **Audit log**: every staff action with who, when and why. It cannot be edited or deleted.

## Good practice

- Write clear, factual reasons ("Counterfeit — 3 reports, photos copied from a shop website").
- Prefer **Reject** (fixable) over **Remove** for honest mistakes.
- Suspend for scams, threats, harassment or repeated serious problems.
- Never ask users for passwords, OTPs or bank PINs, and never move a dispute to private payment.
- If someone may be in danger, advise them to contact the police.
