-- =====================================================================
-- Mojere Market — READ-ONLY inspection of your existing Supabase project
-- =====================================================================
-- This script only READS information. It cannot create, change or delete
-- anything. Run it in Supabase → SQL Editor, then download or screenshot
-- the results so the Mojere Market migration can be checked against what
-- already exists in your project.
-- =====================================================================
with
mojere_names(name) as (values
  ('app_settings'),('user_roles'),('locations'),('categories'),('profiles'),
  ('business_plans'),('business_profiles'),('business_subscriptions'),
  ('listings'),('listing_images'),('favorites'),('user_blocks'),
  ('conversations'),('messages'),('offers'),('reviews'),('reports'),
  ('meetup_locations'),('promotion_packages'),('promotions'),('payment_records'),
  ('admin_actions'),('notifications'),('notification_preferences'),('push_tokens'),
  ('declutter_sessions'),('declutter_session_items')),
tables as (
  select '1. table' as section, c.relname as name,
    'about ' || greatest(c.reltuples, 0)::bigint || ' rows; RLS ' ||
      case when c.relrowsecurity then 'ON' else 'OFF' end ||
      case when c.relname in (select name from mojere_names) then '; NAME CLASH with Mojere Market' else '' end as details
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')),
views as (
  select '2. view', c.relname, case when c.relname in (select name from mojere_names)
    then 'NAME CLASH with Mojere Market' else '' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')),
functions as (
  select '3. function', p.proname, pg_get_function_identity_arguments(p.oid) ||
    case when p.proname like 'mm\_%' then '; NAME CLASH with Mojere Market' else '' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'),
auth_triggers as (
  select '4. trigger on auth.users', t.tgname, 'calls ' || t.tgfoid::regproc::text
  from pg_trigger t where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal),
buckets as (
  select '5. storage bucket', b.id, 'public=' || coalesce(b.public::text, 'false') ||
    case when b.id in ('listing-images', 'profile-images', 'business-images') then '; NAME CLASH with Mojere Market' else '' end
  from storage.buckets b),
users as (
  select '6. auth users', 'total accounts', count(*)::text from auth.users),
extensions as (
  select '7. extension', e.extname, e.extversion from pg_extension e),
version as (
  select '8. postgres version', 'server', current_setting('server_version'))
select * from tables
union all select * from views
union all select * from functions
union all select * from auth_triggers
union all select * from buckets
union all select * from users
union all select * from extensions
union all select * from version
order by 1, 2;
