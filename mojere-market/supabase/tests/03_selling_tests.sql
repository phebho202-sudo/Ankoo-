-- TEST ONLY. Runs after 01 and 02. Follows the exact steps the app takes
-- when selling and decluttering, as the real signed-in user (with RLS).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'dami@example.test', now(), '{"display_name":"Dami"}');
select set_config('t.cat', (select id::text from public.categories where slug = 'furniture'), false);
select set_config('t.lga', (select id::text from public.locations where slug = 'akure-south'), false);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);

-- 1. Save as draft first (what saveListing does).
insert into public.listings (seller_id, category_id, title, description, condition, price_kobo, is_negotiable, lga_id, status)
values (auth.uid(), current_setting('t.cat')::uuid, 'Plastic chairs (4)', '', 'good', 1200000, true, current_setting('t.lga')::uuid, 'draft');
select set_config('t.l', (select id::text from public.listings where title = 'Plastic chairs (4)'), false);

-- 2. Upload photos into own folder, then record them.
insert into storage.objects (bucket_id, name) values
  ('listing-images', '00000000-0000-0000-0000-0000000000d1/a.jpg'),
  ('listing-images', '00000000-0000-0000-0000-0000000000d1/b.jpg');
insert into public.listing_images (listing_id, storage_path, position) values
  (current_setting('t.l')::uuid, '00000000-0000-0000-0000-0000000000d1/a.jpg', 0),
  (current_setting('t.l')::uuid, '00000000-0000-0000-0000-0000000000d1/b.jpg', 1);

select public.t_check((select count(*) from public.mm_search_listings(p_query => 'chairs')) = 0,
  'a draft is not public while photos upload');

-- 3. Publish.
update public.listings set status = 'active' where id = current_setting('t.l')::uuid;
select public.t_check((select count(*) from public.mm_search_listings(p_query => 'chairs')) = 1, 'published listing appears in search');
select public.t_check((select cover_path from public.mm_search_listings(p_query => 'chairs')) like '%/a.jpg',
  'the first photo is the cover');

-- Editing: reorder photos (delete and re-insert, as the app does).
delete from public.listing_images where listing_id = current_setting('t.l')::uuid;
insert into public.listing_images (listing_id, storage_path, position) values
  (current_setting('t.l')::uuid, '00000000-0000-0000-0000-0000000000d1/b.jpg', 0);
select public.t_check(public.t_rows($q$delete from storage.objects where name = '00000000-0000-0000-0000-0000000000d1/a.jpg'$q$) = 1,
  'sellers can delete their own photo files');
select public.t_check((select cover_path from public.mm_search_listings(p_query => 'chairs')) like '%/b.jpg',
  'changing the cover photo works');

-- Pause, resume, mark sold.
update public.listings set status = 'paused' where id = current_setting('t.l')::uuid;
select public.t_check((select count(*) from public.mm_search_listings(p_query => 'chairs')) = 0, 'paused listings are hidden');
update public.listings set status = 'active' where id = current_setting('t.l')::uuid;
update public.listings set status = 'sold' where id = current_setting('t.l')::uuid;
select public.t_check((select sold_at is not null from public.listings where id = current_setting('t.l')::uuid), 'marking sold records the date');

-- ---------- Declutter My Home ----------
insert into public.declutter_sessions (user_id, title) values (auth.uid(), 'Bedroom');
select set_config('t.s', (select id::text from public.declutter_sessions where title = 'Bedroom'), false);
insert into public.listings (seller_id, category_id, title, condition, price_kobo, lga_id, status)
values (auth.uid(), current_setting('t.cat')::uuid, 'Bedside lamp', 'good', 300000, current_setting('t.lga')::uuid, 'draft'),
       (auth.uid(), current_setting('t.cat')::uuid, 'Old mirror', 'fair', 200000, current_setting('t.lga')::uuid, 'draft');
insert into public.declutter_session_items (session_id, listing_id)
select current_setting('t.s')::uuid, id from public.listings where title in ('Bedside lamp', 'Old mirror');
select public.t_check((select count(*) from public.declutter_session_items where session_id = current_setting('t.s')::uuid) = 2,
  'items are added to a declutter session');

-- Publish both drafts at once (what "Publish all" does).
update public.listings set status = 'active'
where id in (select listing_id from public.declutter_session_items where session_id = current_setting('t.s')::uuid)
  and status = 'draft';
select public.t_check((select count(*) from public.mm_search_listings(p_seller_id => auth.uid())) = 3,
  'publishing a declutter session makes its items public');

-- ---------- Someone else trying to interfere ----------
-- Eve was suspended in 01; use Bob, an active user.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.t_check((select count(*) from public.declutter_sessions) = 0, 'others cannot see my declutter sessions');
select public.t_check(public.t_rows($q$update public.listings set status = 'paused' where title = 'Bedside lamp'$q$) = 0,
  'others cannot pause my listings');
select public.t_blocked($q$insert into public.declutter_session_items (session_id, listing_id)
  select current_setting('t.s')::uuid, id from public.listings where title = 'Old mirror'$q$,
  'others cannot add to my session');
select public.t_blocked($q$insert into public.listing_images (listing_id, storage_path, position)
  select id, '00000000-0000-0000-0000-00000000000b/x.jpg', 5 from public.listings where title = 'Old mirror'$q$,
  'others cannot add photos to my listing');
select public.t_check(public.t_rows($q$delete from storage.objects where name like '00000000-0000-0000-0000-0000000000d1/%'$q$) = 0,
  'others cannot delete my photos');
select public.t_check((select count(*) from storage.objects where name like '00000000-0000-0000-0000-0000000000d1/%') = 0,
  'others cannot even list my photo files');
reset role;

\echo 'ALL SELLING TESTS PASSED'
