-- Undo 20261114000100_mojere_market_admin.sql
begin;
drop function if exists public.mm_admin_set_promotion_status(uuid, text, text);
drop function if exists public.mm_admin_report_context(uuid);
drop function if exists public.mm_admin_list_users(text, int, int);
drop function if exists public.mm_admin_stats();
commit;
