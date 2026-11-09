-- TEST ONLY. Runs after 01–04. Businesses, plans, promotions and payments.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'shop@example.test', now(), '{"display_name":"Shop Owner"}');
select set_config('t.cat', (select id::text from public.categories where slug = 'electronics'), false);
select set_config('t.lga', (select id::text from public.locations where slug = 'akure-south'), false);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);

-- Business profile and the free plan.
insert into public.business_profiles (owner_id, name, slug, description, lga_id)
values (auth.uid(), 'Akure Gadgets', 'akure-gadgets', 'Phones and accessories', current_setting('t.lga')::uuid);
select set_config('t.biz', (select id::text from public.business_profiles where slug = 'akure-gadgets'), false);
select public.mm_request_business_plan('free');
select public.t_check((select count(*) from public.business_subscriptions s join public.business_plans p on p.id = s.plan_id
  where s.status = 'active' and p.code = 'free') = 1, 'the free plan starts immediately');
select public.t_blocked($q$update public.business_profiles set status = 'suspended' where slug = 'akure-gadgets'$q$,
  'owners cannot change their business status');

-- Free plan: 10 active business listings, the 11th is refused.
insert into public.listings (seller_id, business_id, category_id, title, condition, price_kobo, lga_id, status)
select auth.uid(), current_setting('t.biz')::uuid, current_setting('t.cat')::uuid, 'Charger ' || n, 'brand_new', 300000,
  current_setting('t.lga')::uuid, 'active'
from generate_series(1, 10) n;
select public.t_blocked($q$insert into public.listings (seller_id, business_id, category_id, title, condition, price_kobo, lga_id, status)
  values (auth.uid(), current_setting('t.biz')::uuid, current_setting('t.cat')::uuid, 'Charger 11', 'brand_new', 300000,
  current_setting('t.lga')::uuid, 'active')$q$, 'the free plan limits active business listings');
insert into public.listings (seller_id, business_id, category_id, title, condition, price_kobo, lga_id, status)
values (auth.uid(), current_setting('t.biz')::uuid, current_setting('t.cat')::uuid, 'Charger 11', 'brand_new', 300000,
  current_setting('t.lga')::uuid, 'draft');
select public.t_check(true, 'drafts do not count towards the limit');
update public.listings set status = 'paused' where title = 'Charger 1';
update public.listings set status = 'active' where title = 'Charger 11';
select public.t_check((select status = 'active' from public.listings where title = 'Charger 11'), 'pausing one frees a slot');

-- Paid plan request waits for payment.
select set_config('t.sub', public.mm_request_business_plan('basic')::text, false);
select public.t_check((select status = 'pending_payment' from public.business_subscriptions where id = current_setting('t.sub')::uuid),
  'a paid plan waits for payment');

-- Promotion request.
select set_config('t.item', (select id::text from public.listings where title = 'Charger 2'), false);
select set_config('t.promo', public.mm_request_promotion(current_setting('t.item')::uuid, 'featured_7d')::text, false);

-- Users cannot create or process payments themselves.
select public.t_blocked($q$select * from public.mm_create_payment(auth.uid(), 'promotion', current_setting('t.promo')::uuid)$q$,
  'users cannot create payment records directly');
select public.t_blocked($q$select public.mm_process_payment('MM-FAKE', 100000, 'NGN', '{}')$q$,
  'users cannot mark payments as paid');
select public.t_blocked($q$select public.mm_admin_activate_promotion(current_setting('t.promo')::uuid, 'I paid')$q$,
  'users cannot activate their own promotion');
reset role;

-- ---------- Payment server (service role) ----------
set role service_role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('t.ref', (select reference from public.mm_create_payment(
  '00000000-0000-0000-0000-0000000000b1', 'promotion', current_setting('t.promo')::uuid)), false);
select public.t_check((select amount_kobo = 100000 and status = 'initialized' from public.payment_records
  where reference = current_setting('t.ref')), 'the price comes from the database (₦1,000 for 7 days)');

select public.t_check(public.mm_process_payment(current_setting('t.ref'), 100, 'NGN', '{}') = 'amount_mismatch',
  'a payment for the wrong amount is refused');
select public.t_check((select status = 'pending_payment' from public.promotions where id = current_setting('t.promo')::uuid),
  'the promotion stays inactive after a wrong amount');

-- A fresh, correct payment.
select set_config('t.ref2', (select reference from public.mm_create_payment(
  '00000000-0000-0000-0000-0000000000b1', 'promotion', current_setting('t.promo')::uuid)), false);
select public.t_check(public.mm_process_payment(current_setting('t.ref2'), 100000, 'NGN', '{"status":"success"}') = 'activated',
  'a correct payment activates the promotion');
select public.t_check(public.mm_process_payment(current_setting('t.ref2'), 100000, 'NGN', '{}') = 'already_processed',
  'the same payment is never processed twice');
select public.t_check(public.mm_process_payment('MM-DOES-NOT-EXIST', 100000, 'NGN', '{}') = 'not_found', 'unknown references are ignored');
select public.t_check((select status = 'active' and ends_at > now() + interval '6 days' from public.promotions
  where id = current_setting('t.promo')::uuid), 'the promotion runs for 7 days');

-- Subscription payment.
select set_config('t.ref3', (select reference from public.mm_create_payment(
  '00000000-0000-0000-0000-0000000000b1', 'business_subscription', current_setting('t.sub')::uuid)), false);
select public.t_check((select amount_kobo = 500000 from public.payment_records where reference = current_setting('t.ref3')),
  'Business Basic costs ₦5,000');
select public.mm_process_payment(current_setting('t.ref3'), 500000, 'NGN', '{}');
reset role;

-- ---------- Results the owner and the public can see ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select public.t_check((select count(*) from public.business_subscriptions s join public.business_plans p on p.id = s.plan_id
  where s.status = 'active' and p.code = 'basic') = 1
  and (select count(*) from public.business_subscriptions where status = 'active') = 1,
  'paying for Basic replaces the free plan');
select public.t_check((select count(*) from public.payment_records where status = 'success') = 2, 'owners can see their payments');
select public.t_check((select count(*) from public.notifications where type = 'promotion') = 1, 'owners are told the promotion is live');
insert into public.listings (seller_id, business_id, category_id, title, condition, price_kobo, lga_id, status)
values (auth.uid(), current_setting('t.biz')::uuid, current_setting('t.cat')::uuid, 'Charger 12', 'brand_new', 300000,
  current_setting('t.lga')::uuid, 'active');
select public.t_check(true, 'the Basic plan allows more active listings');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.t_check((select bool_or(is_featured) from public.mm_search_listings(p_featured_only => true)
  where title = 'Charger 2'), 'a paid promotion shows as Featured');
select public.t_check((select count(*) from public.business_profiles where slug = 'akure-gadgets') = 1, 'storefronts are public');
select public.t_blocked($q$select count(*) from public.payment_records$q$, 'payment records are private');
reset role;

-- ---------- Admin manual activation (audited) ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('t.promo2', public.mm_request_promotion((select id from public.listings where title = 'Charger 3'), 'featured_3d')::text, false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.mm_admin_activate_promotion(current_setting('t.promo2')::uuid, 'Paid ₦500 in cash at the office');
select public.t_check((select count(*) from public.admin_actions where action = 'promotion_activate_manual') = 1,
  'manual activation is written to the audit log');
reset role;

\echo 'ALL BUSINESS TESTS PASSED'
