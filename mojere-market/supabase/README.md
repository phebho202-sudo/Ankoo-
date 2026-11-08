# Mojere Market database (Supabase)

| File | What it is | Run on your real project? |
|---|---|---|
| `inspect/00_readonly_inspection.sql` | Read-only check of what already exists | **Yes, first.** Changes nothing |
| `migrations/20261108000100_mojere_market_core.sql` | Tables, security rules, server functions, seed data | Yes, after the check is reviewed |
| `migrations/20261108000200_mojere_market_storage.sql` | Photo buckets and upload rules | Yes, after the core migration |
| `migrations/*.down.sql` | Undo files | Only if ever needed; ask first |
| `tests/*` | Practice-database tests | **Never** |

Step-by-step instructions: [`../docs/SUPABASE_SETUP.md`](../docs/SUPABASE_SETUP.md).

Design notes:
- Prices are stored in **kobo** (₦1 = 100 kobo) as whole numbers.
- Declutter drafts are ordinary listings with status `draft`, grouped by `declutter_sessions`.
- A sale is a *confirmed transaction* only when both buyer and seller confirm the handover of an
  accepted offer (`mm_confirm_handover`). Reviews are only possible after that.
- Payments, promotions and subscriptions can only be activated by trusted server code (Phase 7),
  never by the app.
- Listings are visible immediately; set `app_settings.listings_require_approval` to `true` to
  require moderator approval first.
- Server functions are all named `mm_...`.
