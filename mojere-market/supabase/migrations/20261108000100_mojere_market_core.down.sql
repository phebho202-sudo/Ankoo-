-- Undo 20261108000100_mojere_market_core.sql
--
-- WARNING: this permanently deletes ALL Mojere Market data (listings,
-- messages, offers, profiles...). Only use it before launch, or after a
-- full backup. It removes nothing that the Mojere Market migration did not
-- create: your other tables, functions and auth users are left alone.
-- Undo the storage migration first.
begin;

drop trigger if exists mojere_on_auth_user_created on auth.users;

do $realtime$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public'
               and tablename in ('messages', 'conversations', 'notifications')) then
    alter publication supabase_realtime drop table public.messages, public.conversations, public.notifications;
  end if;
end
$realtime$;

drop table if exists
  public.declutter_session_items, public.declutter_sessions,
  public.push_tokens, public.notification_preferences, public.notifications,
  public.meetup_locations, public.admin_actions, public.reports,
  public.promotions, public.promotion_packages,
  public.reviews, public.offers, public.messages, public.conversations,
  public.user_blocks, public.favorites, public.listing_images, public.listings,
  public.business_subscriptions, public.payment_records,
  public.business_profiles, public.business_plans,
  public.user_profiles, public.categories, public.locations,
  public.app_settings, public.user_roles;

-- Mojere Market's functions all start with mm_.
do $fns$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'mm\_%' loop
    execute format('drop function %s', f.sig);
  end loop;
end
$fns$;

commit;
