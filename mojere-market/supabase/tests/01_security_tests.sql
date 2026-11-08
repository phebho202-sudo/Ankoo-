-- TEST ONLY. Runs against a practice database prepared with 00_supabase_stub.sql
-- and the Mojere Market migrations. Never run this on your real project.
--
-- Plays four people — Alice (seller), Bob (buyer), Eve (trying to misbehave)
-- and Ada (admin) — and checks that the security rules allow and block the
-- right things. Any failed check stops the script with "SECURITY TEST FAILED".
\set ON_ERROR_STOP 1
\set QUIET 1

create function public.t_blocked(q text, label text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'SECURITY TEST FAILED (should have been blocked): %', label;
exception when others then
  if sqlerrm like 'SECURITY TEST FAILED%' then raise; end if;
  raise notice 'ok  blocked: % (%)', label, sqlerrm;
end $$;

create function public.t_check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'SECURITY TEST FAILED: %', label; end if;
  raise notice 'ok  %', label;
end $$;

create function public.t_rows(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'with x as (' || q || ' returning 1) select count(*) from x' into n;
  return n;
end $$;
grant execute on function public.t_blocked(text, text), public.t_check(boolean, text), public.t_rows(text)
  to anon, authenticated;

-- ---------- set-up (as the database owner) ----------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.test', now(), '{"display_name":"Alice","terms_accepted":"true"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.test', null, '{"display_name":"Bob","terms_accepted":"true"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.test', now(), '{"display_name":"Eve"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'ada@example.test', now(), '{"display_name":"Ada"}');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000ad', 'admin');

select set_config('t.cat', (select id::text from public.categories where slug = 'furniture'), false);
select set_config('t.lga', (select id::text from public.locations where slug = 'akure-south'), false);

select public.t_check((select count(*) = 4 from public.user_profiles), 'sign-up creates a profile automatically');
select public.t_check((select terms_accepted_at is not null from public.user_profiles where display_name = 'Alice'),
  'terms acceptance is recorded');

-- ---------- Alice, the seller ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into public.listings (seller_id, category_id, title, description, condition, price_kobo, is_negotiable, lga_id, status)
values (auth.uid(), current_setting('t.cat')::uuid, 'Wooden study table', 'Sturdy table', 'good', 1500000, true,
        current_setting('t.lga')::uuid, 'active');
insert into public.listings (seller_id, category_id, title, condition, price_kobo, lga_id, status)
values (auth.uid(), current_setting('t.cat')::uuid, 'Draft chair', 'fair', 300000, current_setting('t.lga')::uuid, 'draft');
select set_config('t.listing', (select id::text from public.listings where title = 'Wooden study table'), false);
select set_config('t.draft', (select id::text from public.listings where title = 'Draft chair'), false);

select public.t_check((select published_at is not null and moderation_status = 'approved'
  from public.listings where id = current_setting('t.listing')::uuid), 'publishing sets the publish date');
select public.t_blocked($q$update public.user_profiles set account_status = 'suspended' where id = auth.uid()$q$,
  'user cannot change own account status');
select public.t_blocked($q$insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')$q$,
  'user cannot make themselves admin');
select public.t_blocked($q$update public.listings set moderation_status = 'approved', view_count = 999
  where id = current_setting('t.listing')::uuid$q$, 'seller cannot change moderation fields');
select public.t_blocked($q$update public.listings set status = 'removed' where id = current_setting('t.listing')::uuid$q$,
  'seller cannot mark listing as removed by staff');
select public.t_blocked($q$insert into public.payment_records (user_id, purpose, reference, amount_kobo, status)
  values (auth.uid(), 'promotion', 'fake-ref', 50000, 'success')$q$, 'user cannot create a paid payment record');
select public.t_blocked($q$insert into public.listing_images (listing_id, storage_path, position)
  values (current_setting('t.listing')::uuid, '00000000-0000-0000-0000-00000000000e/x.jpg', 0)$q$,
  'photo path must be inside own folder');
insert into public.listing_images (listing_id, storage_path, position)
  values (current_setting('t.listing')::uuid, '00000000-0000-0000-0000-00000000000a/table.jpg', 0);
insert into storage.objects (bucket_id, name) values ('listing-images', '00000000-0000-0000-0000-00000000000a/table.jpg');
select public.t_check(true, 'seller can upload a photo to own folder');
select public.t_blocked($q$insert into public.offers (listing_id, buyer_id, seller_id, made_by, amount_kobo)
  values (current_setting('t.listing')::uuid, auth.uid(), auth.uid(), 'buyer', 100)$q$,
  'offers cannot be inserted directly');

-- ---------- Eve, trying to misbehave ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.t_check(public.t_rows($q$update public.listings set price_kobo = 1
  where id = current_setting('t.listing')::uuid$q$) = 0, 'cannot edit someone else''s listing');
select public.t_check(public.t_rows($q$delete from public.listings where id = current_setting('t.listing')::uuid$q$) = 0,
  'cannot delete someone else''s listing');
select public.t_check((select count(*) from public.listings where id = current_setting('t.draft')::uuid) = 0,
  'cannot see someone else''s draft');
select public.t_check((select count(*) from public.listings where id = current_setting('t.listing')::uuid) = 1,
  'can see a published listing');
select public.t_check(public.t_rows($q$update public.user_profiles set display_name = 'Hacked'
  where id = '00000000-0000-0000-0000-00000000000a'$q$) = 0, 'cannot edit someone else''s profile');
select public.t_blocked($q$insert into storage.objects (bucket_id, name)
  values ('listing-images', '00000000-0000-0000-0000-00000000000a/evil.jpg')$q$, 'cannot upload into another user''s folder');
select public.t_blocked($q$select public.mm_admin_moderate_listing(current_setting('t.listing')::uuid, 'remove', 'x')$q$,
  'non-admin cannot moderate');
select public.t_blocked($q$select public.mm_notify(auth.uid(), 'account', 'x', 'y', '{}')$q$,
  'internal notify function is not callable');
select public.t_check((select count(*) from public.admin_actions) = 0, 'non-staff cannot read audit log');

-- ---------- Bob, the buyer: messaging ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select set_config('t.conv', public.mm_start_conversation(current_setting('t.listing')::uuid)::text, false);
select public.t_check(public.mm_start_conversation(current_setting('t.listing')::uuid)::text = current_setting('t.conv'),
  'starting the same conversation twice reuses it');
insert into public.messages (conversation_id, sender_id, body) values (current_setting('t.conv')::uuid, auth.uid(), 'Is it available?');
select public.t_blocked($q$insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('t.conv')::uuid, '00000000-0000-0000-0000-00000000000a', 'spoof')$q$, 'cannot send as someone else');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.t_check((select count(*) from public.messages) = 0, 'outsider cannot read private messages');
select public.t_check((select count(*) from public.conversations) = 0, 'outsider cannot see conversations');
select public.t_blocked($q$insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('t.conv')::uuid, auth.uid(), 'hi')$q$, 'outsider cannot post into a conversation');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.t_check((select count(*) from public.messages) = 1, 'seller can read the buyer''s message');
select public.t_check((select count(*) from public.notifications where type = 'message') = 1, 'seller is notified of the message');
select public.t_blocked($q$update public.notifications set title = 'changed'$q$, 'notification text cannot be edited');

-- ---------- Offers, counteroffer, acceptance ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select set_config('t.offer', public.mm_make_offer(current_setting('t.listing')::uuid, 1000000, 'Can you do 10k?')::text, false);
select public.t_blocked($q$select public.mm_make_offer(current_setting('t.listing')::uuid, 1100000)$q$,
  'only one open offer per buyer per item');
select public.t_blocked($q$select public.mm_respond_to_offer(current_setting('t.offer')::uuid, 'accept')$q$,
  'buyer cannot accept own offer');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.t_blocked($q$select public.mm_make_offer(current_setting('t.listing')::uuid, 500000)$q$,
  'seller cannot offer on own item');
select set_config('t.counter', public.mm_respond_to_offer(current_setting('t.offer')::uuid, 'counter', 1250000)::text, false);
select public.t_check((select status = 'countered' from public.offers where id = current_setting('t.offer')::uuid),
  'original offer is marked countered');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.mm_respond_to_offer(current_setting('t.counter')::uuid, 'accept');
select public.t_check((select status = 'reserved' from public.listings where id = current_setting('t.listing')::uuid),
  'accepting reserves the listing');
select public.t_blocked($q$select public.mm_submit_review(current_setting('t.counter')::uuid, 5, 'Great')$q$,
  'no review before both confirm the handover');

-- ---------- Handover confirmation and reviews ----------
select public.mm_confirm_handover(current_setting('t.counter')::uuid);
select public.t_check((select status = 'reserved' from public.listings where id = current_setting('t.listing')::uuid),
  'one confirmation alone does not complete the sale');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.mm_confirm_handover(current_setting('t.counter')::uuid);
select public.t_check((select status = 'sold' from public.listings where id = current_setting('t.listing')::uuid),
  'both confirmations mark the item sold');
select public.mm_submit_review(current_setting('t.counter')::uuid, 5, 'Smooth buyer');
select public.t_blocked($q$select public.mm_submit_review(current_setting('t.counter')::uuid, 4)$q$, 'no duplicate reviews');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.t_blocked($q$select public.mm_submit_review(current_setting('t.counter')::uuid, 1, 'fake')$q$,
  'unrelated user cannot review');
select public.t_blocked($q$insert into public.reviews (offer_id, reviewer_id, reviewee_id, rating)
  values (current_setting('t.counter')::uuid, auth.uid(), '00000000-0000-0000-0000-00000000000a', 1)$q$,
  'reviews cannot be inserted directly');

-- ---------- Blocking ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000b');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.t_blocked($q$insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('t.conv')::uuid, auth.uid(), 'hello again')$q$, 'blocked user cannot message');

-- ---------- Promotions cannot be self-activated ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.listings (seller_id, category_id, title, condition, price_kobo, lga_id, status)
values (auth.uid(), current_setting('t.cat')::uuid, 'Reading lamp', 'like_new', 400000, current_setting('t.lga')::uuid, 'active');
select set_config('t.lamp', (select id::text from public.listings where title = 'Reading lamp'), false);
select set_config('t.promo', public.mm_request_promotion(current_setting('t.lamp')::uuid, 'featured_3d')::text, false);
select public.t_check((select status = 'pending_payment' from public.promotions where id = current_setting('t.promo')::uuid),
  'a requested promotion waits for verified payment');
select public.t_blocked($q$update public.promotions set status = 'active'$q$, 'user cannot activate a promotion');

-- ---------- Admin ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.mm_admin_moderate_listing(current_setting('t.lamp')::uuid, 'remove', 'Test removal');
select public.mm_admin_set_account_status('00000000-0000-0000-0000-00000000000e', 'suspended', 'Test suspension');
update public.promotion_packages set price_kobo = 60000 where code = 'featured_3d';
select public.t_check((select count(*) from public.admin_actions) = 3, 'admin actions are written to the audit log');
select public.t_blocked($q$update public.admin_actions set reason = 'edited'$q$, 'audit log cannot be edited');
select public.t_blocked($q$delete from public.admin_actions$q$, 'audit log cannot be deleted');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.t_blocked($q$insert into public.listings (seller_id, category_id, title, condition, price_kobo, lga_id, status)
  values (auth.uid(), current_setting('t.cat')::uuid, 'Scam phone', 'good', 100, current_setting('t.lga')::uuid, 'active')$q$,
  'suspended user cannot post listings');
select public.t_check(public.t_rows($q$update public.categories set name = 'Hacked'$q$) = 0, 'normal user cannot edit categories');

-- ---------- Logged-out visitor ----------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.t_check((select count(*) from public.listings where status = 'sold') = 1, 'visitors can browse public listings');
select public.t_check((select count(*) from public.listings where status = 'removed') = 0, 'visitors cannot see removed listings');
select public.t_blocked($q$select count(*) from public.messages$q$, 'visitors cannot read messages');
select public.t_blocked($q$insert into public.reports (reporter_id, target_type, listing_id, reason)
  values ('00000000-0000-0000-0000-00000000000e', 'listing', current_setting('t.listing')::uuid, 'spam')$q$,
  'visitors cannot file reports');
select public.t_check((select email_verified and not phone_verified from public.mm_verification_status(
  array['00000000-0000-0000-0000-00000000000a'::uuid])), 'verification badges reflect real Auth confirmation');
select public.t_check((select not email_verified from public.mm_verification_status(
  array['00000000-0000-0000-0000-00000000000b'::uuid])), 'unverified email is not shown as verified');
reset role;

\echo 'ALL SECURITY TESTS PASSED'
