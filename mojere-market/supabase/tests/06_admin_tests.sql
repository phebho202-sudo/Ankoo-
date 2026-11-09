-- TEST ONLY. Runs after 01–05. Admin dashboard functions.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Bob reports one of Funmi's messages and Gbenga's fan listing.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.reports (reporter_id, target_type, listing_id, reason, details)
select auth.uid(), 'listing', id, 'scam', 'Asked me to pay a delivery fee' from public.listings where title = 'Standing fan';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
insert into public.reports (reporter_id, target_type, reported_user_id, message_id, reason)
select auth.uid(), 'message', m.sender_id, m.id, 'harassment' from public.messages m where m.body = 'Thanks!';

-- Ordinary users are refused.
select public.t_blocked($q$select public.mm_admin_stats()$q$, 'ordinary users cannot see admin stats');
select public.t_blocked($q$select * from public.mm_admin_list_users()$q$, 'ordinary users cannot list users or emails');
select public.t_blocked($q$select public.mm_admin_report_context((select id from public.reports limit 1))$q$,
  'ordinary users cannot open reports');

-- The admin.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.t_check((select (public.mm_admin_stats() ->> 'open_reports')::int) >= 2, 'stats count open reports');
select public.t_check((select (public.mm_admin_stats() ->> 'revenue_kobo')::bigint) = 600000,
  'stats total verified revenue (₦1,000 promotion + ₦5,000 plan)');
select public.t_check((select count(*) from public.mm_admin_list_users(p_search => 'gbenga')) = 1, 'admins can search users');
select public.t_check((select email = 'gbenga@example.test' from public.mm_admin_list_users(p_search => 'gbenga')),
  'admins can see emails');
select public.t_check((select role = 'admin' from public.mm_admin_list_users(p_search => 'ada@')), 'the user list shows roles');
select public.t_check((select public.mm_admin_report_context(id) -> 'listing' ->> 'title' = 'Standing fan'
  from public.reports where reason = 'scam' and listing_id is not null limit 1), 'a listing report shows the listing');
select public.t_check((select public.mm_admin_report_context(id) -> 'message' ->> 'body' = 'Thanks!'
  from public.reports where reason = 'harassment' limit 1), 'a message report shows the reported message');
select public.t_check((select count(*) from public.admin_actions where action = 'report_view_message') = 1,
  'reading a reported message is audited');
select public.mm_admin_resolve_report((select id from public.reports where reason = 'harassment' limit 1), 'resolved', 'Warned the user');
select public.t_check((select status = 'resolved' and resolved_by = auth.uid() from public.reports where reason = 'harassment' limit 1),
  'admins resolve reports');
select public.mm_admin_set_promotion_status((select id from public.promotions where status = 'active' limit 1), 'refunded', 'Customer refunded in Paystack');
select public.t_check((select count(*) from public.promotions where status = 'refunded') = 1, 'admins can mark a promotion refunded');
select public.t_blocked($q$select public.mm_admin_set_promotion_status((select id from public.promotions limit 1), 'active', 'x')$q$,
  'promotions cannot be switched on this way');

-- Admin reference data management (direct table edits, protected by RLS).
insert into public.categories (slug, name, icon, sort_order) values ('event-items', 'Event items', 'balloon-outline', 14);
update public.business_plans set price_kobo = 450000 where code = 'basic';
insert into public.locations (slug, name, kind, parent_id)
select 'futa-south-gate', 'FUTA South Gate', 'town', id from public.locations where slug = 'akure-south';
insert into public.meetup_locations (lga_id, name, description)
select id, 'Busy public place (example)', 'Daytime, well lit' from public.locations where slug = 'akure-south';
update public.app_settings set value = 'true' where key = 'listings_require_approval';
select public.t_check((select count(*) from public.admin_actions where target_type in
  ('categories', 'business_plans', 'locations', 'meetup_locations', 'app_settings')) >= 5,
  'changes to categories, prices, places and settings are audited');
update public.app_settings set value = 'false' where key = 'listings_require_approval';

-- A moderator can moderate but not change prices or suspend people.
reset role;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'moderator');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public.t_check((select (public.mm_admin_stats() ->> 'users')::int) > 0, 'moderators can see stats');
select public.t_check(public.t_rows($q$update public.business_plans set price_kobo = 1 where code = 'premium'$q$) = 0,
  'moderators cannot change prices');
select public.t_blocked($q$select public.mm_admin_set_account_status('00000000-0000-0000-0000-00000000000b', 'suspended', 'x')$q$,
  'moderators cannot suspend accounts');
reset role;

\echo 'ALL ADMIN TESTS PASSED'
