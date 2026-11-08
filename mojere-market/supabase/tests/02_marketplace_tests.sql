-- TEST ONLY. Runs on the practice database after 01_security_tests.sql.
-- Checks search, filters, sorting, visibility and view counting.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Practice data (owner role). Alice and Eve exist from the security tests.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'chidi@example.test', now(), '{"display_name":"Chidi"}');

select set_config('t.akure', (select id::text from public.locations where slug = 'akure-south'), false);
select set_config('t.owo', (select id::text from public.locations where slug = 'owo'), false);

insert into public.listings (seller_id, category_id, title, description, condition, price_kobo, lga_id, status, published_at)
select '00000000-0000-0000-0000-0000000000c1', c.id, v.title, v.descr, v.cond, v.price, l.id, v.status, now() - v.age
from (values
  ('iPhone 12 Pro 128GB', 'Clean, battery 89%', 'phones-tablets', 'like_new', 25000000::bigint, 'akure-south', 'active', interval '1 hour'),
  ('Samsung A14', 'Works well', 'phones-tablets', 'good', 9000000::bigint, 'owo', 'active', interval '2 hours'),
  ('Reading table', 'Solid wood study table', 'furniture', 'fair', 1500000::bigint, 'akure-south', 'active', interval '3 hours'),
  ('Hidden draft chair', 'draft', 'furniture', 'good', 100000::bigint, 'akure-south', 'draft', interval '4 hours'),
  ('Paused fan', 'paused', 'home-appliances', 'good', 2000000::bigint, 'akure-south', 'paused', interval '5 hours'),
  ('Sold kettle', 'sold already', 'kitchen-household', 'good', 500000::bigint, 'akure-south', 'sold', interval '6 hours')
) as v (title, descr, cat, cond, price, lga, status, age)
join public.categories c on c.slug = v.cat
join public.locations l on l.slug = v.lga;

-- A rejected listing must never show.
insert into public.listings (seller_id, category_id, title, condition, price_kobo, lga_id, status, moderation_status, published_at)
select '00000000-0000-0000-0000-0000000000c1', c.id, 'Rejected fake phone', 'good', 100, current_setting('t.akure')::uuid, 'active', 'rejected', now()
from public.categories c where c.slug = 'phones-tablets';

-- An active promotion on the reading table.
insert into public.promotions (listing_id, package_id, purchaser_id, status, price_kobo, starts_at, ends_at)
select l.id, p.id, l.seller_id, 'active', p.price_kobo, now(), now() + interval '3 days'
from public.listings l, public.promotion_packages p where l.title = 'Reading table' and p.code = 'featured_3d';

-- ---------- As a logged-out visitor ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);

select public.t_check((select count(*) from public.mm_search_listings()) = 3,
  'browse shows only active approved listings (3 of Chidi''s; Alice''s items are sold/removed)');
select public.t_check((select string_agg(title, '|' order by title) from public.mm_search_listings()) =
  'Reading table|Samsung A14|iPhone 12 Pro 128GB', 'drafts, paused, sold and rejected listings are hidden');
select public.t_check((select title from public.mm_search_listings() limit 1) = 'iPhone 12 Pro 128GB', 'newest first by default');
select public.t_check((select title from public.mm_search_listings(p_sort => 'price_asc') limit 1) = 'Reading table', 'sort by lowest price');
select public.t_check((select title from public.mm_search_listings(p_sort => 'price_desc') limit 1) = 'iPhone 12 Pro 128GB', 'sort by highest price');
select public.t_check((select count(*) from public.mm_search_listings(p_query => 'iphone')) = 1, 'search by word');
select public.t_check((select count(*) from public.mm_search_listings(p_query => 'iph')) = 1, 'search by part of a word');
select public.t_check((select count(*) from public.mm_search_listings(p_query => 'study')) = 1, 'search matches the description');
select public.t_check((select count(*) from public.mm_search_listings(p_query => '%')) = 0, 'special characters are treated as text');
select public.t_check((select count(*) from public.mm_search_listings(p_query => 'chair')) = 0, 'search never reveals drafts');
select public.t_check((select count(*) from public.mm_search_listings(p_category_slug => 'phones-tablets')) = 2, 'filter by category');
select public.t_check((select count(*) from public.mm_search_listings(p_lga_id => current_setting('t.owo')::uuid)) = 1, 'filter by LGA');
select public.t_check((select count(*) from public.mm_search_listings(p_min_kobo => 1000000, p_max_kobo => 10000000)) = 2, 'filter by price range');
select public.t_check((select count(*) from public.mm_search_listings(p_conditions => array['like_new', 'fair'])) = 2, 'filter by condition');
select public.t_check((select count(*) from public.mm_search_listings(p_limit => 2)) = 2
  and (select count(*) from public.mm_search_listings(p_limit => 2, p_offset => 2)) = 1, 'pagination');
select public.t_check((select count(*) from public.mm_search_listings(p_limit => 5000)) <= 50, 'page size is capped');
select public.t_check((select count(*) from public.mm_search_listings(p_featured_only => true)) = 1
  and (select title from public.mm_search_listings(p_featured_only => true)) = 'Reading table', 'featured listings come from active promotions');
select public.t_check((select count(*) from public.mm_search_listings(p_seller_id => '00000000-0000-0000-0000-0000000000c1')) = 4,
  'seller page also shows sold items, never drafts');

select public.t_check((select (public.mm_get_listing(id) ->> 'title') = 'iPhone 12 Pro 128GB'
  from public.listings where title = 'iPhone 12 Pro 128GB'), 'product page loads a public listing');
select public.t_check((select (public.mm_get_listing(id) -> 'seller' ->> 'display_name') = 'Chidi'
  from public.listings where title = 'iPhone 12 Pro 128GB'), 'product page includes the seller');
select public.t_check((select (public.mm_get_listing(id) ->> 'view_count') is null
  from public.listings where title = 'iPhone 12 Pro 128GB'), 'view counts are private to the seller');

reset role;
select set_config('t.draft', (select id::text from public.listings where title = 'Hidden draft chair'), false);
select set_config('t.phone', (select id::text from public.listings where title = 'iPhone 12 Pro 128GB'), false);
set role anon;
select public.t_check(public.mm_get_listing(current_setting('t.draft')::uuid) is null, 'drafts cannot be opened by others');
select public.t_check((select count(*) from public.favorites) = 0, 'visitors see no one''s favourites');
select public.t_check((public.mm_get_listing(current_setting('t.phone')::uuid) ->> 'is_favourite')::boolean = false,
  'visitors can open a product page');

-- ---------- View counting ----------
select public.mm_record_listing_view(current_setting('t.phone')::uuid);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.mm_record_listing_view(current_setting('t.phone')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public.mm_record_listing_view(current_setting('t.phone')::uuid);  -- own view: not counted
select public.t_check((select (public.mm_get_listing(current_setting('t.phone')::uuid) ->> 'view_count')::int) = 2,
  'views are counted, but not the seller''s own');
select public.t_check((public.mm_get_listing(current_setting('t.draft')::uuid) ->> 'title') = 'Hidden draft chair',
  'sellers can open their own drafts');
select public.t_blocked($q$update public.listings set view_count = 999 where id = current_setting('t.phone')::uuid$q$,
  'sellers still cannot edit view counts directly');
select public.t_blocked($q$update public.listings set moderation_status = 'approved' where title = 'Rejected fake phone'$q$,
  'sellers still cannot approve their own listings');
reset role;

\echo 'ALL MARKETPLACE TESTS PASSED'
